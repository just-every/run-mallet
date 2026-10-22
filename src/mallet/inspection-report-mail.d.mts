interface DeliveryEvent {
 provider: string
 providerMessageId: string
 deliveryId: string | null
 recipients: readonly string[]
}
export function createD1EventStore(options: {db: D1Database}): object
export function createDeliveryEventIntake(options: {
 provider: string
 tenantId: string
 eventNamespace: string
 key: string
 store: object
 authorize: (event: DeliveryEvent) => Promise<boolean>
}): {ingestWebhook(input: {rawBody: Uint8Array; headers: Headers}): Promise<unknown>}
