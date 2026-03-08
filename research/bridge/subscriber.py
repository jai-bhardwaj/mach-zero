from sbedecoder import SBESchema, SBEMessage

# Load the single source of truth
schema = SBESchema()
schema.parse('common/schemas/market_data.xml')

def on_message(buffer, offset, length, header):
    # Dynamically decode based on the XML definition
    message = SBEMessage.parse_message(schema, buffer, offset)
    print(f"Trade: Price={message.price}, Qty={message.quantity}")