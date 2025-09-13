# MS Teams + Hubot Integration Observations

In a Posts Channel, when sending @hubot a message, the `type` is `message` and the `channelId` is `msteams`. Why is the channelId msteams? That's so weird. The name of the channel is `bot-testing`.

Looking at the `conversation` stanza, `isGroup` is `true` and `conversationType` is `channel`. That kinda makes sense because it's a public channel.

There's a `recipient` stanza. In this case it's `test-bot` the name of my Hubot instance.

finally, the `channelData` stanza has the ids that are needed to send messages to the channel; `teamsChannelId`, `teamsTeamId` and a `channel` stanza that has id, which is the same value as `teamsChannelId` 🤪. AND there's a `team` stanza which has an id as the same value as the `teamsTeamId` 🤪. Just gonna say it, "who designed this schema?", knowing that I've made these same decisions myself because of non-technical (political) reasons.

There's a mistake in the Hubot teams adapter data mapping. The `room` is set to teh `channelId`, which is not correct (the value is `msteams` WHUT!). I need to change that mapping to ~~`channelData.channel.id`. I'm unsure if I should use that or `teamsChannelId`. But I'll just make an intuitive guess and see what happens.~~ ~~Consider setting room to the conversationReference because it will have the conversation id.~~ Try setting room to the `context.activity`. It has the `conversation` and `channelData` objects.

Note to self: Envelope **SHOULD** have the room and who it's from. Just like a real envelope has the senders name and address, as well as the addressees name and address. I guess if it's an @tted message, the addressee is the person who was @tted and if it's just a message to a public room, it's ????

The envelope probably should have the "message" since the TextMessage has the Teams message object for script authors to have access to use.

