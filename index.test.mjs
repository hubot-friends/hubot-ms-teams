import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Robot, TextMessage, User } from 'hubot'
import { EventEmitter } from 'node:events'
import { MsTeamsAdapter } from './src/MsTeamsAdapter.mjs'
import init, { HubotActivityHandler } from './index.mjs'
import {
    TurnContext,
    TextFormatTypes
} from 'botbuilder'

class TeamsCloudAdapter extends EventEmitter {
    constructor(auth) {
        super()
    }
    async process(req, res, callback) {
        await callback(new TurnContext(this, req.body))
    }
    async createConversationAsync(botAppId, channelId, serviceUrl, audience, conversationParameters, logic) {
        const conversationReference = {
            conversation: { id: Date.now() },
            serviceUrl: serviceUrl,
            channelId: conversationParameters.channelData.channel.id
        }
        await logic(new TurnContext(this, {
            ...conversationReference
        }))
    }
    async sendActivities(context) {
        this.emit('sendActivity', context)
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
                channelId: 'msteams',
                conversation: {
                    isGroup: true,
                    conversationType: 'channel',
                    name: 'Test Conversation',
                    id: '19:integration-conversation',
                    tenantId: 'test-tenant-id'
                },
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
                channelId: 'msteams',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                id: 'test-id',
                type: 'message',
                conversation: {
                    isGroup: true,
                    conversationType: 'channel',
                    name: 'Test Conversation',
                    id: '19:integration-conversation',
                    tenantId: 'test-tenant-id'
                }
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
                channelId: 'msteams',
                id: 'test-id',
                type: 'message',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                conversation: {
                    conversationType: 'personal',
                    isGroup: false,
                    id: 'a:112388d8s8djj',
                    tenantId: 'test-tenant-id'
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
        await robot.messageRoom({
            channelData: {
                channel: { id: 'test-room' },
                team: { id: 'test-team' }
            }
        }, messageToSend)
        
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
        const result = await robot.messageRoom({
            channelData: {
                channel: { id: 'nonexistent-room' },
                team: { id: 'test-team' }
            }
        }, 'test message')

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
        
        await robot.messageRoom({
            channelData: {
                channel: { id: 'test-room' },
                team: { id: 'test-team' }
            }
        }, cardMessage)
        
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
                channelId: 'msteams',
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                conversation: {
                    isGroup: true,
                    conversationType: 'channel',
                    name: 'Test Conversation',
                    id: '19:test-conversation-id',
                    tenantId: 'test-tenant-id'
                },
                serviceUrl: 'https://test.service.url',
                id: 'test-message-id',
                type: 'message'
            })
        })

        assert.equal(response.status, 200)
        
        // Verify that the conversation reference was stored
        const storedRef = robot.adapter.conversationReferences['19:test-conversation-id']
        assert.ok(storedRef, 'Conversation reference should be stored')
        assert.equal(storedRef.conversation.id, '19:test-conversation-id')
        assert.equal(storedRef.serviceUrl, 'https://test.service.url')
    })

    it('Should not intercept non-Teams POST requests (e.g., GitHub webhooks)', async () => {
        let githubHandlerCalled = false
        
        // Register a GitHub webhook handler
        robot.router.post('/github-webhook', async (req, res) => {
            githubHandlerCalled = true
            assert.equal(req.body.repository, 'test-repo')
            res.status(200).send('webhook received')
        })
        
        // Send a GitHub webhook payload (which doesn't have a 'type' field)
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/github-webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-GitHub-Event': 'push'
            },
            body: JSON.stringify({
                repository: 'test-repo',
                commits: [],
                ref: 'refs/heads/main'
            })
        })

        assert.equal(response.status, 200)
        assert.equal(githubHandlerCalled, true)
    })

    it('Should only handle POST requests to /api/messages, not /', async () => {
        let rootHandlerCalled = false
        
        // Register a handler for root path
        robot.router.post('/', async (req, res) => {
            rootHandlerCalled = true
            res.status(200).send('root handler')
        })
        
        // POST to root should be handled by the custom handler, not the Teams adapter
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                some: 'data'
            })
        })

        assert.equal(response.status, 200)
        assert.equal(rootHandlerCalled, true)
        const responseText = await response.text()
        assert.equal(responseText, 'root handler')
    })

    it('Should set textFormat to Markdown for messages with markdown content', async () => {
        let sendActivityCalled = false
        let capturedActivity = null
        
        robot.adapter.on('sendActivity', context => {
            sendActivityCalled = true
            capturedActivity = context
        })
        
        robot.respond(/markdown test/i, async (res) => {
            await res.reply('**bold** and *italic* text')
        })
        
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '@test-bot markdown test',
                channelId: 'msteams',
                conversation: {
                    isGroup: true,
                    conversationType: 'channel',
                    name: 'Test Conversation',
                    id: '19:integration-conversation',
                    tenantId: 'test-tenant-id'
                },
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                id: 'test-id',
                type: 'message'
            })
        })

        assert.equal(response.status, 200)
        assert.equal(sendActivityCalled, true)
        assert.ok(capturedActivity, 'Activity should be captured')
        assert.equal(capturedActivity.textFormat, TextFormatTypes.Markdown, 'Text format should be Markdown')
    })

    // Speach Synthesis Markup Language (SSML)
    it('Should set textFormat to Xml for SSML messages', async () => {
        let sendActivityCalled = false
        let capturedActivity = null
        
        robot.adapter.on('sendActivity', context => {
            sendActivityCalled = true
            capturedActivity = context
        })
        
        robot.respond(/ssml test/i, async (res) => {
            await res.reply(`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="string">
    <mstts:backgroundaudio src="string" volume="string" fadein="string" fadeout="string"/>
    <mstts:voiceconversion url="string"/>
    <voice name="string" effect="string">
    <audio src="string"></audio>
        <bookmark mark="string"/>
        <break strength="string" time="string" />
        <emphasis level="value"></emphasis>
        <lang xml:lang="string"></lang>
        <lexicon uri="string"/>
    </voice>
</speak>`)
        })
        
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '@test-bot ssml test',
                channelId: 'msteams',
                conversation: {
                    isGroup: true,
                    conversationType: 'channel',
                    name: 'Test Conversation',
                    id: '19:integration-conversation',
                    tenantId: 'test-tenant-id'
                },
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                id: 'test-id',
                type: 'message'
            })
        })

        assert.equal(response.status, 200)
        assert.equal(sendActivityCalled, true)
        assert.ok(capturedActivity, 'Activity should be captured')
        assert.equal(capturedActivity.textFormat, TextFormatTypes.Xml, 'Text format should be Xml')
    })

    it('Should set textFormat to Markdown for markdown with inline HTML elements', async () => {
        let sendActivityCalled = false
        let capturedActivity = null
        
        robot.adapter.on('sendActivity', context => {
            sendActivityCalled = true
            capturedActivity = context
        })
        
        robot.respond(/inline html test/i, async (res) => {
            await res.reply('**bold markdown** with <span>test html element</span> inline with markdown')
        })
        
        const response = await fetch(`http://127.0.0.1:${robot.server.address().port}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '@test-bot inline html test',
                channelId: 'msteams',
                conversation: {
                    isGroup: true,
                    conversationType: 'channel',
                    name: 'Test Conversation',
                    id: '19:integration-conversation',
                    tenantId: 'test-tenant-id'
                },
                from: {
                    id: 'test-user',
                    name: 'test-user-name'
                },
                id: 'test-id',
                type: 'message'
            })
        })

        assert.equal(response.status, 200)
        assert.equal(sendActivityCalled, true)
        assert.ok(capturedActivity, 'Activity should be captured')
        assert.equal(capturedActivity.textFormat, TextFormatTypes.Markdown, 'Text format should be Markdown even with inline HTML')
    })
})
