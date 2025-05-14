#include <stdlib.h>
#include <stdio.h>
#include <stdlib.h>   
#include <time.h>    
#include <unistd.h> 

void test_alloc(void) {

    // allocate 10 blocks of random sizes
    size_t sizes[10];
    void *blocks[10];

    for (int i = 0; i < 10; i++) {
        sizes[i] = (rand() % 250) + 1;
        blocks[i] = malloc(sizes[i]);
        printf("Allocated block of size %zu\n", sizes[i]);
    }

    
    // allocate an extra block
    void *extraBlock = malloc(12);
    printf("Allocated block of size 12\n");

    // wait 5 seconds and free blocks 2,5,8
    sleep(5);
    free(blocks[2]);
    free(blocks[5]);
    free(blocks[8]);
    printf("Freed blocks 2, 5, 8\n");

    // wait 10 seconds before reallocating
    sleep(5);
    void *new_ptr = realloc(extraBlock, 55);
    printf("Reallocated block of size 12 to 55\n");
}

int main(void) {
    // disable stdout buffering
    setvbuf(stdout, NULL, _IONBF, 0);

    // Seed the generator once
    srand((unsigned)time(NULL));

    test_alloc();
    return 0;
}
