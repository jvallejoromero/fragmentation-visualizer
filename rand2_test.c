#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define NUM_PTRS 100
#define MIN_SIZE 1
#define MAX_SIZE 1024

int main(void) {
    void *ptrs[NUM_PTRS];
    size_t sizes[NUM_PTRS];
    
    // disable stdout buffering
    setvbuf(stdout, NULL, _IONBF, 0);

    // Seed random number generator
    srand((unsigned)time(NULL));

    // Allocate 100 pointers of random sizes
    for (int i = 0; i < NUM_PTRS; i++) {
        sizes[i] = (rand() % (MAX_SIZE - MIN_SIZE + 1)) + MIN_SIZE;
        ptrs[i] = malloc(sizes[i]);
        if (!ptrs[i]) {
            fprintf(stderr, "[Error] malloc failed at index %d for size %zu bytes\n", i, sizes[i]);
            // Free any previously allocated pointers before exiting
            for (int j = 0; j < i; j++) {
                free(ptrs[j]);
            }
            return EXIT_FAILURE;
        }
        printf("[Alloc] index %d -> %zu bytes at %p\n", i, sizes[i], ptrs[i]);
    }

    printf("All %d allocations complete. Proceeding to free...\n", NUM_PTRS);

    // Free all pointers
    for (int i = 0; i < NUM_PTRS; i++) {
        free(ptrs[i]);
        printf("[Free ] index %d freed\n", i);
    }

    // // Free pointers with a 50%% chance each
    // for (int i = 0; i < NUM_PTRS; i++) {
    //     if (rand() % 2) {
    //         free(ptrs[i]);
    //         printf("[Free ] index %d freed\n", i);
    //     } else {
    //         printf("[Skip ] index %d retained\n", i);
    //     }
    // }

    printf("All pointers freed.\n");
    return EXIT_SUCCESS;
}