#define _GNU_SOURCE
#include <dlfcn.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>
#include <malloc.h>

// function pointers to the “real” libc allocators
static void* (*real_malloc)(size_t) = NULL;
static void  (*real_free)(void*) = NULL;
static void* (*real_realloc)(void*, size_t) = NULL;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static bool firstRun = true;

static int coalesce_free_chunks(void);

// A simple chunk-record type
typedef struct chunk {
    void*  ptr;
    size_t size; // user-requested size
    size_t usable; // actual size (payload + padding)
    int    allocated;
    struct chunk* next;
} chunk_t;
static chunk_t* head = NULL;

static void init_real() {
    real_malloc  = dlsym(RTLD_NEXT, "malloc");
    real_free    = dlsym(RTLD_NEXT, "free");
    real_realloc = dlsym(RTLD_NEXT, "realloc");
}

// Insert a new chunk record at head
static void record_alloc(void* p, size_t s) {
    chunk_t* c = real_malloc(sizeof(chunk_t));
    c->ptr  = p;
    c->size = s;
    c->usable = malloc_usable_size(p);
    c->allocated = 1;
    c->next = NULL;

    // sorted insert
    if (!head || p < head->ptr) {
        c->next = head;
        head = c;
    } else {
        chunk_t *it = head;
        while (it->next && it->next->ptr < p) {
            it = it->next;
        }
        c->next = it->next;
        it->next = c;
    }
}

// Mark a chunk as freed
static void record_free(void* p) {
    for (chunk_t* c = head; c; c = c->next) {
        if (c->ptr == p) {
            c->allocated = 0;
            return;
        }
    }
}

// Dump current heap layout to a file
static void dump_layout(bool coalesced) {

    int flags = O_WRONLY|O_CREAT|(firstRun ? O_TRUNC : O_APPEND);
    int fd = open("heap_frag.log", flags, 0644);
    if (fd < 0) return;

    if (firstRun) {
        char hdr[64];
        int n = snprintf(hdr, sizeof(hdr), "&PID=%d\n\n", getpid());
        write(fd, hdr, n);
        firstRun = false;
    }

    if (coalesced) {
        char hdr[64];
        int n = snprintf(hdr, sizeof(hdr), "&coalesced\n");
        write(fd, hdr, n);
    }

    char buf[128];
    for (chunk_t* c = head; c; c = c->next) {
        int n = snprintf(buf, sizeof(buf), "%p %zu %d\n", c->ptr, c->size, c->allocated);
        write(fd, buf, n);
    }
    write(fd, "\n", 1);   // snapshot delimiter
    close(fd);
}

void* malloc(size_t size) {
    if (!real_malloc) init_real();
    void* p = real_malloc(size);
    pthread_mutex_lock(&lock);
      record_alloc(p, size);
      dump_layout(false);
    pthread_mutex_unlock(&lock);
    return p;
}

void free(void* ptr) {
    if (!real_free) init_real();
    pthread_mutex_lock(&lock);

    record_free(ptr);
    dump_layout(false);

    int coalesced = 0;
    if (coalesced == 1) {
        dump_layout(true);
    }
    pthread_mutex_unlock(&lock);
    real_free(ptr);
}

void* realloc(void* ptr, size_t size) {
    if (!real_realloc) init_real();
    void* p = real_realloc(ptr, size);
    pthread_mutex_lock(&lock);
      record_free(ptr);
      record_alloc(p, size);
      dump_layout(false);
    pthread_mutex_unlock(&lock);
    return p;
}

// coalesce any two consecutive free chunks in our list
static int coalesce_free_chunks(void) {
    chunk_t *prev = NULL;
    chunk_t *curr = head;
    bool coalesced = false;

    while (curr && curr->next) {
        // Forward coalesce: curr + curr->size == curr->next
        chunk_t *n = curr->next;

        if (!curr->allocated && !n->allocated) {
            // merge n into curr
            curr->usable += n->usable;
            curr->size += n->size;
            curr->next = n->next;
            real_free(n);
            coalesced = true;
            continue;
        }

        // Backward coalesce: prev + prev->size == curr
        if (prev && !prev->allocated && !curr->allocated) {
            prev->usable += curr->usable;
            prev->size += curr->size;
            prev->next = curr->next;
            real_free(curr);
            // step back: curr = prev, so we can re-check forward
            curr = prev;
            coalesced = true;
            continue;
        }

        // 3) No merge here: advance both pointers
        prev = curr;
        curr = curr->next;
    }
    if (coalesced) {
        return 1;
    } else {
        return 0;
    }
}