import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Robot, TextMessage, User } from 'hubot'
import { EventEmitter } from 'node:events'
import { MsTeamsAdapter } from './src/MsTeamsAdapter.mjs'
import init, { HubotActivityHandler } from './index.mjs'
import {
    TurnContext
} from 'botbuilder'

class TeamsCloudAdapter extends EventEmitter {
    constructor(auth) {
        super()
    }
    async process(req, res, callback) {
        await callback(new TurnContext(this, req.body))
    }
}
describe('Initialize Adapter', () => {
    it('Should initialize adapter', async () => {
        process.env.PORT = 0
        const robot = new Robot(init, true, 'test-bot', null)
        robot.config = {
            TEAMS_BOT_CLIENT_SECRET: 'test-secret',
            TEAMS_BOT_TENANT_ID: 'test-tenant-id',
            TEAMS_BOT_APP_ID: 'test-app-id',
            TEAMS_BOT_APP_TYPE: 'test-app-type'
        }
        await robot.loadAdapter()
        assert.ok(robot.adapter instanceof MsTeamsAdapter)
        let actual = ''
        try {
            await robot.run()
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (robot.server && robot.server.address()) {
                        clearInterval(interval)
                        resolve()
                    }
                }, 100)
            })    
        } catch (error) {
            actual = error.message
        } finally {
            robot.shutdown()
        }
    })
})

describe('MS Teams Adapter', () => {
    let robot = null
    let client = null
    let activityHandler = null
    const defaultMessageMapper = context => new TextMessage(new User(context.activity.from.id, {
        name: context.activity.from.name,
        room: context.activity.channelId,
        message: Object.assign(context, {
            async sendActivity(context) {
                robot.adapter.emit('sendActivity', context)
                return 'ok'
            }
        })
    }), context.activity.text, context.activity.id)
    
    beforeEach(async () => {
        process.env.PORT = 0
        robot = new Robot({
            use(robot) {
                client = new TeamsCloudAdapter({})
                activityHandler = new HubotActivityHandler(robot, defaultMessageMapper)
                return new MsTeamsAdapter(robot, activityHandler, client)
            }
        }, true, 'test-bot')
        robot.config = {
            TEAMS_BOT_CLIENT_SECRET: 'test-secret',
            TEAMS_BOT_TENANT_ID: 'test-tenant-id',
            TEAMS_BOT_APP_ID: 'test-app-id',
            TEAMS_BOT_APP_TYPE: 'test-app-type'
        }
        await robot.loadAdapter()
        await robot.run()
        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (robot.server && robot.server.address()) {
                    clearInterval(interval)
                    resolve()
                }
            }, 100)
        })
    })
    afterEach(() => {
        robot.shutdown()
    })

    it('Respond to @test-bot Hello World', async () => {
        let wasCalled = false
        robot.adapter.on('sendActivity', context => {
            assert.equal(context.text, 'Hello World')
        })
        robot.respond(/Hello World$/, async (res) => {
            assert.equal(res.message.text, '@test-bot Hello World')
            wasCalled = true
            await res.reply('Hello World')
        })
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '@test-bot Hello World',
                channelId: 'test-room',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                id: 'test-id',
                type: 'message'
            })
        })
        assert.equal(response.status, 200)
        assert.deepEqual(wasCalled, true)
    })

    it('Respond to <at>test-bot</at> Helo Worlds', async () => {
        let wasCalled = false
        robot.adapter.on('sendActivity', context => {
            assert.equal(context.text, 'Helo Worlds')
        })
        robot.respond(/Helo Worlds$/, async (res) => {
            assert.equal(res.message.text, '@test-bot Helo Worlds')
            wasCalled = true
            await res.reply('Helo Worlds')
        })
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '<at>test-bot</at> Helo Worlds',
                channelId: 'test-room',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                id: 'test-id',
                type: 'message'
            })
        })
        assert.equal(response.status, 200)
        assert.deepEqual(wasCalled, true)
    })

    it('Responds to a private or Direct Message', async () => {
        let wasCalled = false
        robot.respond(/lunch/i, async (res) => {
            assert.equal(res.message.text, '@test-bot lunch')
            wasCalled = true
            await res.reply('you said lunch')
        })
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'lunch',
                channelId: 'test-user',
                id: 'test-id',
                type: 'message',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                conversation: {
                    conversationType: 'personal',
                    id: 'a:112388d8s8djj'
                },
                recipient: {
                    id: '888adsjjdskueu',
                    name: 'test-bot'
                }
            })
        })
        assert.equal(response.status, 200)
        assert.deepEqual(wasCalled, true)
    })

    it('Should handle messageRoom calls with room only envelope', async () => {
        let sendActivityCalled = false
        let messageToSend = 'Hello from messageRoom'
        
        // Mock the client to track sendActivity calls
        client.continueConversation = async (conversationReference, callback) => {
            const mockContext = {
                async sendActivity(activity) {
                    sendActivityCalled = true
                    assert.equal(activity.text, messageToSend)
                    return 'ok'
                }
            }
            await callback(mockContext)
        }
        
        // Store a conversation reference for the room
        robot.adapter.conversationReferences['test-room'] = {
            conversation: { id: 'test-conversation' },
            serviceUrl: 'https://test.com'
        }
        
        // This should not crash and should send the message
        await robot.messageRoom('test-room', messageToSend)
        
        assert.equal(sendActivityCalled, true)
    })

    it('Should handle messageRoom calls with missing conversation reference', async () => {
        let errorLogged = false
        const originalError = robot.logger.error
        robot.logger.error = (message) => {
            if (message.includes('No conversation reference found for room')) {
                errorLogged = true
            }
            originalError.call(robot.logger, message)
        }
        
        // Attempt to send to a room without a conversation reference
        const result = await robot.messageRoom('nonexistent-room', 'test message')
        
        assert.equal(errorLogged, true)
        assert.deepEqual(result, [])
        
        // Restore original error function
        robot.logger.error = originalError
    })

    it('Should handle messageRoom with adaptive cards', async () => {
        let sendActivityCalled = false
        const cardMessage = JSON.stringify({
            type: 'AdaptiveCard',
            version: '1.0',
            body: [{
                type: 'TextBlock',
                text: 'Hello Card'
            }]
        })
        
        client.continueConversation = async (conversationReference, callback) => {
            const mockContext = {
                async sendActivity(activity) {
                    sendActivityCalled = true
                    assert.ok(activity.attachments)
                    assert.equal(activity.attachments.length, 1)
                    return 'ok'
                }
            }
            await callback(mockContext)
        }
        
        robot.adapter.conversationReferences['test-room'] = {
            conversation: { id: 'test-conversation' },
            serviceUrl: 'https://test.com'
        }
        
        await robot.messageRoom('test-room', cardMessage)
        
        assert.equal(sendActivityCalled, true)
    })

    it('Should store conversation references when receiving messages', async () => {
        // Send a message to the bot to trigger conversation reference storage
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'test message',
                channelId: 'stored-room-id',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                conversation: {
                    id: 'test-conversation-id'
                },
                serviceUrl: 'https://test.service.url',
                id: 'test-message-id',
                type: 'message'
            })
        })

        assert.equal(response.status, 200)
        
        // Verify that the conversation reference was stored
        const storedRef = robot.adapter.conversationReferences['stored-room-id']
        assert.ok(storedRef, 'Conversation reference should be stored')
        assert.equal(storedRef.conversation.id, 'test-conversation-id')
        assert.equal(storedRef.serviceUrl, 'https://test.service.url')
        assert.equal(storedRef.channelId, 'stored-room-id')
    })

    it('Should work end-to-end: receive message then use messageRoom', async () => {
        let messageRoomCalled = false
        let receivedMessage = ''
        
        // Set up the client mock to capture messageRoom calls
        client.continueConversation = async (conversationReference, callback) => {
            const mockContext = {
                async sendActivity(activity) {
                    messageRoomCalled = true
                    receivedMessage = activity.text
                    return 'ok'
                }
            }
            await callback(mockContext)
        }
        
        // First, simulate receiving a message (this stores the conversation reference)
        await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'hello bot',
                channelId: 'integration-test-room',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                conversation: {
                    id: 'integration-conversation'
                },
                serviceUrl: 'https://integration.test.url',
                id: 'integration-message-id',
                type: 'message'
            })
        })
        
        // Now use messageRoom (this should work because we have a stored conversation reference)
        await robot.messageRoom('integration-test-room', 'Response from messageRoom!')
        
        assert.equal(messageRoomCalled, true)
        assert.equal(receivedMessage, 'Response from messageRoom!')
    })
})
