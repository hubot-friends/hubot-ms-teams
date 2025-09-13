import { MsTeamsAdapter } from './src/MsTeamsAdapter.mjs'
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    createBotFrameworkAuthenticationFromConfiguration,
    ActivityHandler,
} from 'botbuilder'
import { TextMessage, User } from 'hubot'

const defaultMessageMapper = context => {

    // Try to simplify the message structure to reduce the memory footprint.
    // I think the problem is that TextMessage (via Message) gets it's room from user.room.
    // And user.room is the entire context.activity object which is huuuuuge.
    // This is an opportunity to feedback into the Hubot Message structure design.
    // Seems to be the interplay between TextMessage (Message) and the envelope in send().
    const activity = context.activity
    const sharedActivity = {
        text: activity.text,
        textFormat: activity.textFormat,
        attachments: activity.attachments,
        type: activity.type,
        timestamp: activity.timestamp,
        localTimestamp: activity.localTimestamp,
        id: activity.id,
        channelId: activity.channelId,
        serviceUrl: activity.serviceUrl,
        from: activity.from,
        conversation: activity.conversation,
        recipient: activity.recipient,
        entities: activity.entities,
        channelData: activity.channelData,
        locale: activity.locale,
        localTimezone: activity.localTimezone,
        rawTimestamp: activity.rawTimestamp,
        rawLocalTimestamp: activity.rawLocalTimestamp,
        callerId: activity.callerId
    }

    const message = new TextMessage(new User(context.activity.from.id, {
        name: context.activity.from.name,
        room: new Proxy(sharedActivity, {
            get(target, prop) {
                return target[prop]
            },
            set(target, prop, value) {
                target[prop] = value
                return true
            }
        }),
        message: context  // this is what the code uses to send messages to MS Bot Service Platform
    }), context.activity.text, context.activity.id)
    return message
}

class HubotActivityHandler extends ActivityHandler {
    #robot = null
    #messageMapper = null
    constructor(robot, messageMapper = defaultMessageMapper) {
        super()
        this.#messageMapper = messageMapper ?? defaultMessageMapper
        this.#robot = robot
        this.onMessage(async (context, next) => {
            await this.#robot.receive(this.#messageMapper(context))
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