#include <stdlib.h>
#include <stdio.h>
#include <stdlib.h>   
#include <time.h>     

void test_alloc(void) {

    // allocate 10 blocks of random sizes
    size_t sizes[10];
    void *blocks[10];

    for (int i = 0; i < 10; i++) {
        sizes[i] = (rand() % 250) + 1;
        blocks[i] = malloc(sizes[i]);
    }

    
    // allocate an extra block
    void *extraBlock = malloc(12);
    void *new_ptr = realloc(extraBlock, 55);

    // free blocks 2,5,8
    free(blocks[2]);
    free(blocks[5]);
    free(blocks[8]);
}

int main(void) {
    // Seed the generator once
    srand((unsigned)time(NULL));

    test_alloc();
    return 0;
}
