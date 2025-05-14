#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

#define NUM_SLOTS 10      // how many “slots” to track
#define MIN_BLOCK  64     // minimum allocation size in bytes
#define MAX_BLOCK 1024    // maximum allocation size in bytes
#define INTERVAL    3     // seconds between each action

int main(void) {
    // disable stdout buffering
    setvbuf(stdout, NULL, _IONBF, 0);
    
    void *slots[NUM_SLOTS] = {0};
    size_t sizes[NUM_SLOTS] = {0};

    // seed RNG
    srand((unsigned)time(NULL));

    for (int i = 0; i < NUM_SLOTS; i++) {
        slots[i] = malloc(25);
        sizes[i] = 25; 
    }

    sleep(INTERVAL);

    while (1) {
        // pick a random slot
        int idx = rand() % NUM_SLOTS;

        if (slots[idx] == NULL) {
            // allocate a new block of random size
            size_t sz = (rand() % (MAX_BLOCK - MIN_BLOCK + 1)) + MIN_BLOCK;
            slots[idx] = malloc(sz);
            if (slots[idx]) {
                sizes[idx] = sz;
                printf("[+] Allocated %zu bytes at slot %d\n", sz, idx);
            } else {
                fprintf(stderr, "malloc failed for %zu bytes\n", sz);
            }
        } else {
            // free the existing block
            printf("[-] Freeing %zu bytes from slot %d\n", sizes[idx], idx);
            free(slots[idx]);
            slots[idx] = NULL;
            sizes[idx] = 0;
        }

        printf("\n");

        // wait before next allocate/free
        sleep(INTERVAL);
    }

    // never reached
    return 0;
}
