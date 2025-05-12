#define _GNU_SOURCE
#include <dlfcn.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>

// function pointers to the “real” libc allocators
static void* (*real_malloc)(size_t)     = NULL;
static void  (*real_free)(void*)        = NULL;
static void* (*real_realloc)(void*, size_t) = NULL;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static bool firstRun = true;

// A simple chunk-record type
typedef struct chunk {
    void*  ptr;
    size_t size;
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
    c->allocated = 1;
    c->next = head;
    head    = c;
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
static void dump_layout() {

    int flags = O_WRONLY|O_CREAT | (firstRun ? O_TRUNC : O_APPEND);
    firstRun = false;

    int fd = open("heap_frag.log", flags, 0644);
    if (fd < 0) return;

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
      dump_layout();
    pthread_mutex_unlock(&lock);
    return p;
}

void free(void* ptr) {
    if (!real_free) init_real();
    pthread_mutex_lock(&lock);
      record_free(ptr);
      dump_layout();    // e.g., snapshot on every free
    pthread_mutex_unlock(&lock);
    real_free(ptr);
}

void* realloc(void* ptr, size_t size) {
    if (!real_realloc) init_real();
    void* p = real_realloc(ptr, size);
    pthread_mutex_lock(&lock);
      record_free(ptr);
      record_alloc(p, size);
      dump_layout();
    pthread_mutex_unlock(&lock);
    return p;
}
