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
})
