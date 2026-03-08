import time
import aeron
from sbedecoder import SBESchema, SBEMessage
from questdb.ingress import Sender, TimestampNanos

# 1. Load your binary "Source of Truth"
schema = SBESchema()
schema.parse('common/schemas/market_data.xml')

def run_sink():
    # Correct Port: 9000 for HTTP Ingestion (ILP)
    conf = 'http::addr=localhost:9000;'
    
    with Sender.from_conf(conf) as qdb_sender:
        print("Mach-Zero: Python Sink Active. Subscribing to Aeron IPC...")

        # Setup Aeron Subscriber to pull from shared memory
        context = aeron.Context()
        with aeron.Aeron(context) as a:
            subscription = a.add_subscription("aeron:ipc", 1001)

            def on_message(buffer, offset, length, header):
                # 2. Decode the binary SBE message
                msg = SBEMessage.parse_message(schema, buffer, offset)
                
                # 3. Map binary fields to QuestDB (Symbol types are auto-deduplicated)
                qdb_sender.row(
                    'trades',
                    symbols={'symbol': str(msg.symbolId)},
                    columns={
                        'price': float(msg.price) / 1e8, # Scaling for fixed-point
                        'qty': float(msg.quantity)
                    },
                    at=TimestampNanos.now()
                )
                
            while True:
                # Poll the Aeron bus; 10 is the fragment limit per cycle
                fragments_read = subscription.poll(on_message, 10)
                
                if fragments_read == 0:
                    time.sleep(0.001) # Reduce CPU usage when idle
                else:
                    qdb_sender.flush() # Commit batch to database

if __name__ == "__main__":
    run_sink()