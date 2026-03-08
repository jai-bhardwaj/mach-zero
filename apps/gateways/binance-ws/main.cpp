#include <Aeron.h>
#include <mach_zero_market_data/Trade.h> // The generated SBE header
#include <iostream>
#include <chrono>
#include <thread>

using namespace mach_zero::market_data;
using namespace aeron;

int main() {
    // 1. Connect to the Aeron Media Driver (ensure it's running!)
    Context ctx;
    Aeron aeron(ctx);
    
    // 2. Create a Publication on the IPC channel
    // 'aeron:ipc' is free and uses shared memory locally
    long publicationId = aeron.addPublication("aeron:ipc", 1001);
    auto publication = aeron.findPublication(publicationId);
    while (!publication) { publication = aeron.findPublication(publicationId); }

    // 3. Prepare the SBE Encoder
    char buffer[256];
    AtomicBuffer atomicBuffer(reinterpret_cast<uint8_t*>(buffer), sizeof(buffer));
    Trade trade;

    std::cout << "Mach-Zero: Gateway Starting..." << std::endl;

    while (true) {
        // Encode a dummy trade with zero-copy flyweights
        trade.wrapAndApplyHeader(buffer, 0, sizeof(buffer));
        trade.symbolId(12345) // e.g., BTCUSDT
            .price(4500000)   // $45,000.00 (scaled int)
            .quantity(100)
            .side(Side::Buy)
            .timestamp(std::chrono::system_clock::now().time_since_epoch().count());

        // 4. Offer to the bus (include SBE header + body)
        publication->offer(atomicBuffer, 0, Trade::sbeBlockAndHeaderLength());
        
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }
}