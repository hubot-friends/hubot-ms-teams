import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import Robot from 'hubot/src/robot.js'
import Module from 'module'
import { EventEmitter } from 'node:events'
import { MsTeamsAdapter } from './src/MsTeamsAdapter.mjs'
import init from './index.mjs'
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    createBotFrameworkAuthenticationFromConfiguration,
    MessageFactory,
    ActivityHandler,
    CardFactory,
    TextFormatTypes,
    TurnContext
} from 'botbuilder'
import { TextMessage } from 'hubot/src/message.js'
import User from 'hubot/src/user.js'


let originalRequire = Module.prototype.require
const hookModuleToReturnMockFromRequire = (module, mock) => {
  Module.prototype.require = function() {
    if (arguments[0] === module) {
      return mock;
    }
    return originalRequire.apply(this, arguments)
  }
}
const reset = () => {
    Module.prototype.require = originalRequire
}

class TeamsCloudAdapter extends EventEmitter {
    constructor(auth) {
        super()
    }
    async process(req, res, callback) {
        await callback(new TurnContext(this, req.body))
    }
}
class TeamsActivityHandler extends ActivityHandler {
    constructor(robot) {
        super()
        this.robot = robot
        this.onMessage(async (context, next) => {
            context.activity.text = context.activity.text.replace(/^\r\n/, '').replace(/\\n$/, '').trim()
            const message = new TextMessage(new User(context.activity.from.id, {
                name: context.activity.from.name,
                room: context.activity.channelId,
                message: Object.assign(context, {
                    async sendActivity(context) {
                        this.emit('sendActivity', context)
                        return 'ok'
                    }
                })
            }), context.activity.text, context.activity.id)
            await this.robot.receive(message)
            await next()
        })
    }
    async run(context) {
        return await super.run(context)
    }
}

describe('Initialize Adapter', () => {
    beforeEach(() => {
        hookModuleToReturnMockFromRequire('@hubot-friends/hubot-ms-teams', {
            async use(robot) {
                return await init(robot)
            }
        })
    })
    afterEach(() => {
        reset()
    })
    it('Should initialize adapter', async () => {
        process.env.PORT = 0
        const robot = new Robot('@hubot-friends/hubot-ms-teams', true, 'test-bot', null)
        robot.config = {
            TEAMS_BOT_CLIENT_SECRET: 'test-secret',
            TEAMS_BOT_TENANT_ID: 'test-tenant-id',
            TEAMS_BOT_APP_ID: 'test-app-id',
            TEAMS_BOT_APP_TYPE: 'test-app-type'
        }
        await robot.loadAdapter('./index.mjs')
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
    beforeEach(async () => {
        hookModuleToReturnMockFromRequire('hubot-friends/hubot-ms-teams', {
            use(robot) {
                client = new TeamsCloudAdapter({})
                activityHandler = new TeamsActivityHandler(robot)
                return new MsTeamsAdapter(robot, activityHandler, client)
            }
        })
        process.env.PORT = 0
        robot = new Robot('hubot-friends/hubot-ms-teams', true, 'test-bot')
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
        reset()
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
})
