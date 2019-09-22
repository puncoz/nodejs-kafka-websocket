const { server: WebSocketServer } = require("websocket")
const { createServer: createHttpServer } = require("http")
const { Consumer: KafkaConsumer, KafkaClient, Producer: KafkaProducer } = require("kafka-node")

// Initialize Kafka
const kafkaClient = new KafkaClient("localhost:9092")
const kafkaConsumer = new KafkaConsumer(kafkaClient, [
    {
        topic: 'test',
        partition: 0
    }
], {
        autoCommit: false
    })
const kafkaProducer = new KafkaProducer(kafkaClient)

// Initialize http server
const httpServer = createHttpServer((req, res) => {
    console.log(`Request received: ${req.url}`)

    res.writeHead(404)
    res.end()
})

const port = 8081
httpServer.listen(port, () => {
    console.log(`Listening to the port ${port}`)
})

// Initialize WebSocket
const webSocketServer = new WebSocketServer({
    httpServer: httpServer,
    autoAcceptConnections: false
})

const isOriginAllowed = (origin) => {
    return true
}

webSocketServer.on("request", (req) => {
    if (!isOriginAllowed(req.origin)) {
        req.reject()
        console.log(`Connection from ${req.origin} rejected.`)
        return
    }

    const connection = req.accept('echo-protocol', req.origin)
    console.log(`Connection accepted: ${req.origin}`)

    connection.on("message", (message) => {
        if (message.type === "utf8") {
            console.log(`Received message: ${message.utf8Data}`)

            kafkaProducer.send([
                {
                    topic: "test",
                    partition: 0,
                    messages: message.utf8Data
                }
            ], () => {
                console.log("Data streamed to kafka.")
            })
        }
    })

    kafkaConsumer.on('message', (message) => {
        console.log(`Message from kafka:`, message)
        connection.sendUTF(message.value)
    })

    connection.on("close", (reasonCode, description) => {
        console.log(`Connection ${connection.remoteAddress} closed.`)
    })
})