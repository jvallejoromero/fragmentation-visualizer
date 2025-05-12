#include <stdlib.h>
#include <stdio.h>

void test_alloc(void) {
    // 1) Allocate three blocks of different sizes
    void *blk1 = malloc(64);
    void *blk2 = malloc(128);
    void *blk3 = malloc(32);

    // 2) Free the middle one—creates a “hole” between blk1 and blk3
    free(blk2);

    // 3) Allocate another block that’s smaller than the hole
    //    (so it fits into blk2’s freed space)
    void *blk4 = malloc(96);

    // 4) Free the first block—now there’s a hole at the front
    free(blk1);

    // 5) Allocate one more block that’s larger than blk1 but smaller
    //    than (blk1 + blk2) combined, forcing it to go after blk4
    void *blk5 = malloc(80);

    // 6) Clean up the rest
    // free(blk3);
    free(blk4);
    // free(blk5);
}

int main(void) {
    test_alloc();
    return 0;
}
