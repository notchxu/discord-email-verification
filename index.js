const CONFIG = process.env.DISCORD_LOGIN_API_TOKEN == undefined ? require('./config.json') : process.env

// const ENCRYPTED_MEMBERS = process.env.MEMBERS == undefined ? require('./members.json') : process.env.MEMBERS

// const MEMBERS = ENCRYPTED_MEMBERS.members.map(email => email.toLowerCase())
// (CONFIG.CRYPTO_JSON_MEMBER_ENCRYPT_KEY != undefined
//   ? cryptoJSON.decrypt(ENCRYPTED_MEMBERS, CONFIG.CRYPTO_JSON_MEMBER_ENCRYPT_KEY, {
//     encoding: CONFIG.CRYPTO_JSON_ENCODING,
//     keys: ['members'],
//     algorithm: CONFIG.CRYPTO_JSON_ALGORITHM
//   }).members : ENCRYPTED_MEMBERS.members)

const { Email } = require('./smtp.js')

const Discord = require('discord.js')
const client = new Discord.Client()

const Keyv = require('keyv')
const discord_email = new Keyv(CONFIG.DATABASE_URL, { namespace: 'discord_email' })
const code_email_temp = new Keyv(CONFIG.DATABASE_URL, { namespace: 'code_email_temp' })
const code_discord_temp = new Keyv(CONFIG.DATABASE_URL, { namespace: 'code_discord_temp' })
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

code_discord_temp.clear()
code_email_temp.clear()

client.once('ready', () => console.log('Starting!'))

client.login(CONFIG.DISCORD_LOGIN_API_TOKEN).then(console.log('Logged In!'))

client.on('message', message => {
  if (message.author.bot) {
    return
  }
  let text = message.content.trim()
  if (message.channel.id === CONFIG.VERIFY_CHANNEL_ID && message.content === '!verify') {
    message.author
      .createDM()
      .then(dmchannel =>
        dmchannel.send('To gain access to the Course 18 Discord, please enter your full MIT email address.').catch(reason => console.log(reason))
      )
      .catch(reason => console.log(reason))
  } else if (message.type === 'GUILD_MEMBER_JOIN') {
    message.channel
      .send("<@" + message.author.id + ">, welcome to the Course 18 discord! Please type '!verify' in the #verification channel to verify your email. If an email doesn't arrive in a few minutes or you run into other issues, DM one of us mods for manual verification.")
      .catch(reason => console.log(reason))
  }
  else if (message.channel.guild == null) {
    if (new RegExp(CONFIG.EMAIL_REGEX).test(text)) {
      let email_address = text.toLowerCase();
      if (isMember(email_address)) {
        let code = makeid(6)
        code_email_temp.set(code, email_address, 10 * 60 * 1000)
        code_discord_temp.set(code, message.author.id, 10 * 60 * 1000)
        sendEmail(email_address, code)
          .then(
            message.channel
              .send("Check your email now! Reply with the code we sent you (NOTE: may take a few moments to send / may appear in spam. If you don't see your email there, please message one of us mods instead.)")
              .catch(reason => console.log(reason))
          )
          .catch(reason => console.log(reason))
      } else {
        message.channel.send("Unfortunately, we don't seem to recognize that email :( Please try again.").catch(reason => console.log(reason))
      }
    } else if (text.match(/^[a-zA-Z0-9]{6}$/)) {
      Promise.all([code_email_temp.get(text), code_discord_temp.get(text)])
        .then(([email_address, discord_id]) => {
          if (email_address && discord_id && discord_id === message.author.id) {
            discord_email.set(message.author.id, email_address)
            let guild = client.guilds.get(CONFIG.GUILD_ID)
            let role = guild.roles.find(role => role.name === CONFIG.ROLE_NAME)
            let internal_channel = guild.channels.find(channel => channel.id === CONFIG.VERIFICATION_RECORD_CHANNEL_ID)
            guild
              .fetchMember(message.author)
              .then(member => member.addRole(role))
              .then(message.channel.send("Welcome aboard! Head over to #roles and get your ranks to complete the joining process!").catch(reason => console.log(reason)))
              .then(internal_channel.send("<@" + message.author.id + "> was successfully verified with email **" + email_address + "**").catch(reason => console.log(reason)))
              .catch(reason => console.log(reason))
          } else {
            message.channel.send("Unfortunately, that code doesn't seem to be correct. Please try again. (NOTE: if your code really /was/ correct, try !verify in #verification again and ask for another verification email.)")
          }
        })
        .catch(reason => console.log(reason))
    }
  }
})

// isMember = email_address => MEMBERS.indexOf(email_address.toLowerCase()) > -1
isMember = email_address => email_address.endsWith("@mit.edu") || email_address.endsWith("@math.mit.edu")

// https://www.smtpjs.com/
sendEmail = (email_address, code) =>
  Email.send({
    SecureToken: CONFIG.SMPT_JS_LOGIN_TOKEN,
    To: email_address,
    From: CONFIG.FROM_EMAIL,
    Subject: CONFIG.EMAIL_SUBJECT,
    Body: 'Welcome to the Course 18 Discord! Your code is: ' + code
  })

makeid = length => [...Array(length)].map(() => ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length))).join('')
