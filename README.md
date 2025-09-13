# Hubot MS Teams Adapter

This is a [MS Teams Adapter](https://dev.botframework.com) for [Hubot](https://github.com/hubotio/hubot/), a popular chatbot framework. With this adapter, you can connect your Hubot instance to MS Teams and interact with users through chat.

## TLDR; Expert Summary

- Create a Hubot codebase locally with `npx hubot --create . -a @hubot-friends/hubot-ms-teams`
- Create a `.env` file at the root of the new codebase with required environment varialbes
- Use CloudFalared to route a publicly accesseable domain to your local instance of Hubot
- Create a new Application Registration in Azure
- Create a new Bot Service with that new Application ID
- Get the app id and secret from the Bot Service configuration and put them in the `.env` file
- Create a `manifest.json` file with 2 icons, zip them up and upload a new application in MS Teams Developer Portal
- Publish it to your organization and wait for a few hours for Azure's data to get caught up because the bot won't be immediately available in Teams

## Installation

To use this adapter, you'll need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed on your system. Then, you can install `@hubot-friends/hubot-ms-teams` using npm:

```sh
npm install @hubot-friends/hubot-ms-teams
```

## Configuration

To configure `hubot-ms-teams`, you'll need to set a few environment variables:

- `TEAMS_BOT_CLIENT_SECRET`: Your Application Password (Client Secret when you register a new application in Azure)
- `TEAMS_BOT_TENANT_ID`: Your Azure Account Tenant ID
- `TEAMS_BOT_APP_ID`: Application ID when you register a new Application in Azure.
- `TEAMS_BOT_APP_TYPE`: SingleTenant || MultiTenant

You can set these environment variables in a `.env` file in your Hubot project directory, or by exporting them in your shell.

## Usage

To start your Hubot instance with the adapter, run (if `hubot` is in your `PATH`):

```sh
TEAMS_BOT_CLIENT_SECRET=<secret> TEAMS_BOT_TENANT_ID=<tenantid> TEAMS_BOT_APP_ID=<appid> TEAMS_BOT_APP_TYPE=<apptype> hubot -a @hubot-friends/hubot-ms-teams -n jbot
```

Replace `<...>` with your values.

Once your Hubot instance is running, you can interact with it through chat in a channel you've added Hubot to.

## Local Development

Make a directory for your Hubot and run the following in it:

```sh
npx hubot@latest --create . -a @hubot-friends/hubot-ms-teams
```

Note: The **period** after `--create` means, "create all the files in this directory".

You can now start Hubot with `npm start` but since the MS Teams Adapter isn't configured with secrets and stuff, it won't do anything but log a message and wait. You can visit `http://localhost:8080` in your browser and it'll say something like "Can't GET /". But if you see that, you're good so far.

Leave Hubot running.

### BotFramework-Emulator

If you want to start developing scripts and testing out your Hubot instance, download the [BotFramework-Emulator](https://github.com/Microsoft/BotFramework-Emulator/blob/master/README.md). Start it, click **Open Bot**. Enter `http://localhost:8080/api/messages` and click **Connect**.

Type `@hubot help` and you should see a message from Hubot.

At this point, you can start creating scripts in the `scripts` folder. Reference Hubot's [tests](https://github.com/hubotio/hubot/blob/main/test/message_test.js) and [Documentation](https://hubotio.github.io/hubot/scripting.html) for help.

## Going Live Set Up Instructions

### Summary

- Domain name with valid SSL Cert
- Azure account
- Azure Resource Group
- Azure Application Registration
- Azure Bot Service
- App ID, Tenant ID, Client Secret (password)

## Steps

MS Azure really wants you to use their Bot Services and Azure resources for chat bots. All their documentation assumes your own that paved path. So utilizing Hubot for a MS Teams chat bot as a little bit off-road. Here's what worked as of `2023-10-20 4:53 PM CST`.

The **Azure Bot Service** platform communicates with your bot via **HTTPS**. Thus, requires a publically accessible and addressable [domain name](https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Web_mechanics/What_is_a_domain_name) which routes to your bot instance and has a valid SSL certificate.

### Addresseable Local Hubot Instance

There are many approaches to enabling Azur's Bot Service platform to send HTTPS requests to your local Hubot instance.

TLDR; I'm going to use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) because you can [register a domain name](https://developers.cloudflare.com/registrar/), use [their tools](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and they provide some level of security. You can [jump](#cloudflared) to those instructions if you prefer.

```sh
 cloudflared tunnel run --token ${token}
 ```
 
#### Approaches

- Port forwarding: Configure your home router to forward requests from port `80` to port `80` of the IP Address of the Hubot instance. Then search the internet for "what's my ip", get your publically visible IP Address and use that when entering the **Messaging Endpoint** referenced below in **Bot Service Configuration**.
- Dynamic DNS (DDNS): Use a DDNS service to map a domain name to your Hubot instance via DDNS client software.
- VPN and Reverse Proxy: Set up a VPN server on your network, configure a reverse proxy server (e.g. Nginx or Apache) to forward external requests to your local Hubot instance; Use the public IP of your VPN server in the **Bot Service Configuration**.
- Third-Party Tools: Run a client app that creates a tunnel to a publicly accessible server which can be configured to route traffic to your Hubot instance
    * [ngrok](https://ngrok.com)
    * [pagekite](https://pagekite.net)
    * [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

### <a name="cloudflared">Cloudflare Tunnel</a>

[Signup for Cloud Flare](https://www.cloudflare.com).

Register a domain. I think you can use **ngrok** or **pagekite** if you don't want to register a domain. But remember that Azure's Bot Service platform needs the Hubot endpoint to have a valid SSL cert.

[Download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) the `cloudflared` CLI and create a [locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/). Their documentation is going to explain better than I can.

### Create a new *Resource Group*

Once you're setup with a running instance of Hubot and it's publicly accessible, you're ready to start setting up the Azure side of things.

You need an [Azure](https://portal.azure.com) account. Signup if you don't already have one.

You need a [Resource Group](https://portal.azure.com/#view/HubsExtension/BrowseResourceGroups) if you haven't created one already. Create one to use later if you don't have one.

### Create a new *App Registration*

Create a new [App Registration](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).

- Single Tenant
- No redirect URI is necessary to get started. I think it's if you're going to build a web app that utilizes SSO
- Click the Register button

### Create a new *Bot Service*

You can go to the Bot Services page, but it's easier to create a Bot Service by going to the [creating a resource](https://portal.azure.com/#create/hub) page, type `azure bot` in the search field on the page and hit enter. Then click/select the Azure Bot one.

On the next page, click the Create button.

Enter a Bot handle. It's like an ID, so no need to use the Hubot instance name that you intend to use for the Hubot name. Just pick some kind of identifier.

You'll need to have a Subscription. It should be automatically selected to the one you're assigned to. If you don't have a Subscription to pick, that's a whole 'nother story. Create a Github issue and we'll work our way through it.

Then pick a **Resource Group**.

The Pricing tier should be **Standard**. That's fine for now. Unless you have a different plan to pick from.

The Type of App can be **Single Tenant**. I think Multi Tenant is for the scenario where you're building a bot for people outside of your Azure Organization to use.

Select **Use existing app registration** in the **Creation Type** area. Open another tab to the [Azure Portal](https://portal.azure.com). Go to "App Registrations" and click on the "All applications" tab. Then click on the application you just registered. Copy the **Application (client) ID** by mousing over the ID and click the `Copy` icon that shows up on the right.

Now go back to the browser tab where you're creating the new Bot Service and paste that Application (client) Id into the **App ID** field.

Go back to the App Registration browser tab that you opened earlier and copy the **Directory (tenant) ID** value.

Paste that value into the **App tenant ID** field in the page where you're creating the new Bot Service.

Click the **Next** button. If you want to add tags, feel free to do so on this next page.

Click the **Next** button. Review the info and then click the **Create** button.

The page will ask you if you want to "leave". Just click Ok.

### Bot Service Configuration

Enter `https://<your bot's domain name>/api/messages` in the Messaging endpoint field. Remember making your Hubot instance accessible and addressable from above? It was for this moment when you have to fill in the Messaging endpoint. 

Click **Enable Streaming Endpoing**. I'm not sure what this does, but it sounds like I want it.

Click **Apply** at the bottom.

#### Secret/Password - Documentation uses these interchangeably

Click on the **Manage Password** link next to **Microsoft App ID**.

Create a new Client Secret by clicking **New client secret**. Note that the secret will only be shown once. So copy it and paste it into your `.env` file if you have one. You will **not** be able to come back to this page to get it again. Make sure to copy the **Value** and not the Secret ID.

### Add Application in MS Teams

The final step is to add the app to MS Teams. This requires creating a `manifest.json` file and [2 icons](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/design/design-teams-app-icon-store-appbar) for Teams to use for your new application/bot. Edit the `manifest.json` file in this repo, replace the place holders with your values and then create a zip file of the `manifest.json`, `icon-32.png` and `icon-192.png` files. Ues this zip file when importing the app in MS Teams Developer Portal.

Go to MS Teams. Click on the elipses on the left hand side menu, towards the bottom.

Search for **Developer Portal** and click on that.

Click on the **Apps** tab in Developer Portal. Click **Import app**.

### Hubot Setup

I run a local Hubot instance in my terminal. So I have a `.env` file with all the required environment variables to configure Hubot to connect with the MS Teams adapter. It looks like the following:

```ini
TEAMS_BOT_APP_ID=<Application ID from the registered application in Azure>
TEAMS_BOT_CLIENT_SECRET=<secret/password you created in Azure Bot Service Configuration>
TEAMS_BOT_TENANT_ID=<tenant id from Azure Bot Service Configuration>
TEAMS_BOT_APP_TYPE=SingleTenant
NODE_ENV=development
HUBOT_LOG_LEVEL=debug
```

If you're using `npm run start:local` to start your instance, make sure you're running Node.js version > 20.6 and that the "start:local" property in your `package.json` file `scripts` section looks like `node --env-file=.env ./node_modules/hubot/bin/hubot.js --adapter @hubot-friends/hubot-ms-teams` so the `.env` file is loaded into the session environment. I like to include `--watch` as a `node` option during development to restart every time I make code changes.

My `package.json` `scripts` section looks like:

```json
{
    ...
    "scripts": {
        "start": "hubot -a @hubot-friends/hubot-ms-teams -n jbot",
        "start:local": "node --watch --env-file=.env ./node_modules/hubot/bin/hubot.js --adapter @hubot-friends/hubot-ms-teams",
        "test": "node --test"
    }
    ...
}
```

## Contributing

If you find a bug or have a feature request, please open an issue on the [GitHub repository](https://github.com/hubot-friends/hubot-ms-teams). Pull requests are also welcome!

## License

`hubot-ms-teams` is released under the [MIT License](https://opensource.org/licenses/MIT).