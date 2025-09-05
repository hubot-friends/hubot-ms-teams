import { Adapter } from 'hubot'
import EventEmitter from 'node:events'
import {
    MessageFactory,
    CardFactory,
    TextFormatTypes,
    TurnContext
} from 'botbuilder'

const CONTENT_LENGTH_LIMIT = 2_000
const conversationTypeMiddleware = {
    personal(body, robot) {
        const robotName = (robot.alias == false ? undefined : robot.alias) ?? robot.name
        if (robotName == body.recipient.name && body.text.indexOf(`@${robotName} ` == -1)) {
            body.text = `@${robotName} ${body.text}`
        }
        return body
    }
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
        this.robot.logger.info(`[onTurnError] ${error} ${JSON.stringify(context)}`)
        await context.sendTraceActivity('onTurnError trace', `${error}`, 'https://www.botframework.com/schemas/error', 'TurnError')
        await context.sendActivity('The bot encountered an error.')
    }
    async send(envelope, ...strings) {
        // Handle messageRoom calls where envelope only has room property
        if (envelope.room && !envelope.user) {
            return await this.sendToRoom(envelope.room, ...strings)
        }
        // Handle regular send calls with user.message
        const responses = await this.sendWithDelegate(envelope.user.message, envelope, ...strings)
        this.emit('send', envelope, responses)
        return responses
    }
    async sendToRoom(room, ...strings) {
        const conversationReference = this.conversationReferences[room]
        if (!conversationReference) {
            this.robot.logger.error(`No conversation reference found for room: ${room}`)
            return []
        }
        
        const responses = []
        await this.#client.continueConversation(conversationReference, async (context) => {
            for await (let message of strings) {
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
                
                try {
                    const response = await context.sendActivity(teamsMessage)
                    if (response) {
                        responses.push(response)
                    }
                } catch (e) {
                    if(e.statusCode && e.statusCode === 401){
                        this.robot.logger.error(`${this.robot.name}: Unauthorized, check TEAMS_BOT_APP_ID, TEAMS_BOT_CLIENT_SECRET, TEAMS_BOT_APP_TYPE, and TEAMS_BOT_TENANT_ID`)
                    } else {
                        this.robot.logger.error(`${this.robot.name}: ${e}`)
                    }
                }
            }
        })
        
        this.emit('send', { room }, responses)
        return responses
    }
    async reply(envelope, ...strings) {
        const responses = await this.sendWithDelegate(envelope.user.message, envelope, ...strings)
        this.emit('reply', envelope, responses)
        return responses
    }
    async sendWithDelegate(delegate, envelope, ...strings) {
        const responses = []
        for await (let message of strings) {
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
            try {
                const response = await delegate.sendActivity(teamsMessage)
                if (response) {
                    responses.push(response)
                }
            } catch (e) {
                if(e.statusCode && e.statusCode === 401){
                    this.robot.logger.error(`${this.robot.name}: Unauthorized, check TEAMS_BOT_APP_ID, TEAMS_BOT_CLIENT_SECRET, TEAMS_BOT_APP_TYPE, and TEAMS_BOT_TENANT_ID`)
                } else {
                    this.robot.logger.error(`${this.robot.name}: ${e}`)
                }
            }
        }
        return responses
    }
    async run() {
        this.robot.router.use(async (req, res, next) => {
            this.robot.logger.debug(`request: ${JSON.stringify({url: req.url, headers: req.headers, body: req.body})}`)
            next()
        })
        this.robot.router.post(['/', '/api/messages'], async (req, res)=>{
            const robotName = (this.robot.alias == false ? undefined : this.robot.alias) ?? this.robot.name
            req.body.text = req.body.text
                .replace(/^\r\n/, '')
                .replace(/\\n$/, '')
                .replace(`<at>${robotName}</at> `, `@${robotName} `)
                .trim()

            if(conversationTypeMiddleware[req.body?.conversation?.conversationType]) {
                req.body = conversationTypeMiddleware[req.body.conversation.conversationType](req.body, this.robot)
            }
            
            try { 
                await this.#client.process(req, res, async context => {
                    // Store conversation reference for messageRoom functionality
                    const conversationReference = TurnContext.getConversationReference(context.activity)
                    this.conversationReferences[context.activity.channelId] = conversationReference
                    
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