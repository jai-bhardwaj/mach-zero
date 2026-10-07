#include <chrono>
#include <cstdio>
#include <set>
#include <mach/mach_time.h>
int main(){
    mach_timebase_info_data_t tb; mach_timebase_info(&tb);
    printf("mach timebase: %u/%u  -> %.4f ns per tick\n", tb.numer, tb.denom, (double)tb.numer/tb.denom);
    // empirical: distinct non-zero deltas from back-to-back steady_clock reads
    std::set<long long> deltas;
    for (int i=0;i<200000;i++){
        auto a=std::chrono::steady_clock::now();
        auto b=std::chrono::steady_clock::now();
        long long d=std::chrono::duration_cast<std::chrono::nanoseconds>(b-a).count();
        if(d>0) deltas.insert(d);
    }
    printf("smallest 8 non-zero deltas observed between consecutive clock reads:\n  ");
    int n=0; for(auto d:deltas){ printf("%lld ", d); if(++n==8) break; }
    printf("\n");
    return 0;
}
