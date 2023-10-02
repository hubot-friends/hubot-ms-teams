# Hubot Discord Adapter

This is a [Discord](https://discord.com/developers/applications) adapter for [Hubot](https://github.com/hubotio/hubot/), a popular chatbot framework. With this adapter, you can connect your Hubot instance to a Discord server and interact with users through chat.

## Installation

To use this adapter, you'll need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed on your system. Then, you can install `hubot-discord` using npm:

```sh
npm install @hubot-friends/hubot-discord
```


## Configuration

To configure `hubot-discord`, you'll need to set a few environment variables:

- `HUBOT_DISCORD_TOKEN`: Your Discord bot token. You can create a new bot and get a token from the [Discord Developer Portal](https://discord.com/developers/applications).

Don't forget to add your instance of Hubot to the channels with which you want to interact with it.

You can set these environment variables in a `.env` file in your Hubot project directory, or by exporting them in your shell.

## Usage

To start your Hubot instance with the Discord adapter, run (if `hubot` is in your `PATH`):

```sh
HUBOT_DISCORD_TOKEN=<your-bot-token> hubot -a @hubot-friends/hubot-discord -n jbot
```

Replace `<your-bot-token>` with your Discord bot token.

Once your Hubot instance is running, you can interact with it through chat in the Discord channel you've added Hubot to.

## Contributing

If you find a bug or have a feature request, please open an issue on the [GitHub repository](https://github.com/hubot-friends/hubot-discord). Pull requests are also welcome!

## License

`hubot-discord` is released under the [MIT License](https://opensource.org/licenses/MIT).