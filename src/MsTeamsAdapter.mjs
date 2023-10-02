import Adapter from 'hubot/src/adapter.js'
import EventEmitter from 'node:events'
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    createBotFrameworkAuthenticationFromConfiguration,
    MessageFactory,
    CardFactory,
    TextFormatTypes
} from 'botbuilder'
import { TextMessage } from 'hubot/src/message.js'
const CONTENT_LENGTH_LIMIT = 2_000

const mapToTextMessage = (message, botName, client) => {
    const content = message.content.replace(`<@${client?.user?.id}> `, `@${botName} `)
    const user = Object.assign({
        room: message.channelId,
        name: message.author.username,
        message: message
    }, message.author)
    return new TextMessage(user, content, message.id, message)
}

class MsTeamsAdapter extends Adapter {
    #client
    #activityHandler
    constructor(robot, activityHandler = new EventEmitter(), client = new EventEmitter()) {
        super(robot)
        this.#activityHandler = activityHandler
        this.#client = client
        this.#client.onTurnError = this.#onTurnError
        this.conversationReferences = {}
    }
    async #onTurnError(context, error) {
        this.robot.logger.info('[onTurnError]', error, context)
        await context.sendTraceActivity('OnTurnError Trace', `${error}`, 'https://www.botframework.com/schemas/error', 'TurnError')
        await context.sendActivity('The bot encountered an error.')
    }
    #wasToBot(message, botId) {
        return message.mentions && !message.mentions.users.find(u => u.id == botId)
    }
    messageWasReceived(message) {
        if(message.author.bot) return
        if(!message.guildId && message.content.indexOf(this.client.user.id) == -1) {
            message.content = `<@${this.client.user.id}> ${message.content}`
            message.mentions.users.set(this.client.user.id, this.client.user)
        }

        if(this.#wasToBot(message, this.client.user.id)) return
        const textMessage = mapToTextMessage(message, this.robot.name || this.robot.alias, this.client)
        this.robot.receive(textMessage)
    }
    async send(envelope, ...strings) {
        const responses = await this.sendWithDelegate(envelope.user.message.sendActivity.bind(this), envelope, ...strings)
        this.emit('send', envelope, responses)
        return responses
    }
    async reply(envelope, ...strings) {
        const responses = await this.sendWithDelegate(envelope.user.message.sendActivity.bind(this), envelope, ...strings)
        this.emit('reply', envelope, responses)
        return responses
    }
    async sendWithDelegate(delegate, envelope, ...strings) {
        const tasks = []
        for (let message of strings) {
            let teamsMessage = MessageFactory.text(message, message)
            let card = null

            teamsMessage.textFormat = TextFormatTypes.Markdown
            if (/<\/(.*)>/.test(message)) {
                teamsMessage.textFormat = TextFormatTypes.Xml
            }
            
            try {
                card = JSON.parse(message)
                teamsMessage = {
                    attachments: [ CardFactory.adaptiveCard(card) ]
                }
            } catch(e) {
                this.robot.logger.debug(`message isn't a card: ${e}`)
            }
            tasks.push(delegate(teamsMessage))
        }
        const responses = []
        try {
            const results = await Promise.all(tasks)
            for (let result of results) {
                responses.push(result)
            }
        } catch (e) {
            if(e.statusCode && e.statusCode === 401){
                this.robot.logger.error(`${this.robot.name}: Unauthorized, check TEAMS_BOT_APP_ID, TEAMS_BOT_CLIENT_SECRET, TEAMS_BOT_APP_TYPE, and TEAMS_BOT_TENANT_ID`)
            } else {
                this.robot.logger.error(`${this.robot.name}: ${e}`)
            }
        }
        return responses
    }
    async run() {
        this.robot.router.use(async (req, res, next) => {
            this.robot.logger.debug('from the web', req.url, req.headers, req.body)
            next()
        })
        this.robot.router.post('/api/messages', async (req, res)=>{
            try { 
                await this.#client.process(req, res, async context => {
                    await this.#activityHandler.run(context)
                    res.status(200).send('ok')
                })
            } catch (e) {
                this.logger.info(e)
            }
        })
        this.robot.server.on('upgrade', async (req, socket, head) => {
            console.log('upgrading to websockets')
            await this.#client.process(req, socket, head, (context) => this.#activityHandler.run(context));
        })
        this.emit('connected', this)
        this.robot.logger.info(`${MsTeamsAdapter.name} adapter is running as @${this.robot.name}.`)
    }
    close () {
        this.robot.logger.info(`${MsTeamsAdapter.name} adapter is closing.`)
        this.emit('disconnected')
    }
}
export default MsTeamsAdapter
export {
    MsTeamsAdapter
}  