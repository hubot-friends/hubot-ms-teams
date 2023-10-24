import { MsTeamsAdapter } from './src/MsTeamsAdapter.mjs'
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    createBotFrameworkAuthenticationFromConfiguration,
    ActivityHandler,
} from 'botbuilder'
import { TextMessage } from 'hubot/src/message.js'
import User from 'hubot/src/user.js'

const defaultMessageMapper = context => new TextMessage(new User(context.activity.from.id, {
    name: context.activity.from.name,
    room: context.activity.channelId,
    message: context  // this is what the code uses to send messages to MS Bot Service Platform
}), context.activity.text, context.activity.id)

class HubotActivityHandler extends ActivityHandler {
    #robot = null
    #messageMapper = null
    constructor(robot, messageMapper = defaultMessageMapper) {
        super()
        this.#messageMapper = messageMapper ?? defaultMessageMapper
        this.#robot = robot
        this.onMessage(async (context, next) => {
            context.activity.text = context.activity.text
                .replace(/^\r\n/, '')
                .replace(/\\n$/, '')
                .replace(`<at>${this.#robot.name}</at> `, `@${this.#robot.name} `)
                .replace(`<at>${this.#robot.alias}</at> `, `@${this.#robot.alias} `)
                .trim()
            await this.#robot.receive(this.#messageMapper.call(this, context))
            await next()
        })
    }
}
export {
    HubotActivityHandler
}
export default {
    async use(robot) {
        robot.config = {
            TEAMS_BOT_CLIENT_SECRET: process.env.TEAMS_BOT_CLIENT_SECRET ?? null,
            TEAMS_BOT_TENANT_ID: process.env.TEAMS_BOT_TENANT_ID ?? null,
            TEAMS_BOT_APP_ID: process.env.TEAMS_BOT_APP_ID ?? null,
            TEAMS_BOT_APP_TYPE: process.env.TEAMS_BOT_APP_TYPE ?? null
        }
        const credentials = new ConfigurationServiceClientCredentialFactory({
            MicrosoftAppId: process.env.TEAMS_BOT_APP_ID,
            MicrosoftAppPassword: process.env.TEAMS_BOT_CLIENT_SECRET,
            MicrosoftAppType: process.env.TEAMS_BOT_APP_TYPE ?? 'MultiTenant',
            MicrosoftAppTenantId: process.env.TEAMS_BOT_TENANT_ID
        })
        const auth = createBotFrameworkAuthenticationFromConfiguration(null, credentials)
        const client = new CloudAdapter(auth)
        const activityHandler = new HubotActivityHandler(robot)
        const adapter = new MsTeamsAdapter(robot, activityHandler, client)
        return adapter
    }
}