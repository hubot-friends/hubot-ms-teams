import { MsTeamsAdapter } from './src/MsTeamsAdapter.mjs'
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    createBotFrameworkAuthenticationFromConfiguration,
    MessageFactory,
    ActivityHandler,
    CardFactory,
    TextFormatTypes,
} from 'botbuilder'
import { TextMessage } from 'hubot/src/message.js'
import User from 'hubot/src/user.js'

class HubotActivityHandler extends ActivityHandler {
    #robot = null
    constructor(robot) {
        super()
        this.#robot = robot
        this.onMessage(async (context, next) => {
            context.activity.text = context.activity.text.replace(/^\r\n/, '').replace(/\\n$/, '').trim()
            await this.#robot.receive(new TextMessage(new User(context.activity.from.id, {
                name: context.activity.from.name,
                room: context.activity.channelId,
                message: context // add the context to the user object so we can use it later
            }), context.activity.text, context.activity.id))
            await next()
        })
    }
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