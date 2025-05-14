#include <stdlib.h>

int main(void) {
    void *a = malloc(25);
    void *b = malloc(28);
    free(a);
    free(b);

    return 0;
}