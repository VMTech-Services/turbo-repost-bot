require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const userMessages = {};

bot.start((ctx) => {
    if (ctx.chat.type === 'private') {
        ctx.reply(
            `Welcome to the Repost Bot!

Here's how to use me:
1. **Save a Message:**  
   Send any text, photo, video, audio, or document message in this DM.
   I'll save your message and assign it a unique numeric ID.

2. **Resend a Message Inline:**  
   In any chat, type @turboREbot. You will see the last 5 messages you sent here as suggestions.
   You can also type the numeric ID to resend a specific message.

Enjoy using the bot!`
        );
    }
});

bot.command('clear', (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    if (userMessages[userId]) {
        userMessages[userId] = [];
        ctx.reply('✅ Your saved messages have been cleared.');
    } else {
        ctx.reply('ℹ️ You don’t have any saved messages.');
    }
});

bot.command('test',(ctx)=>{
    ctx.reply('test')
})

function saveUserMessage(ctx) {
    const userId = ctx.from.id;
    if (!userMessages[userId]) {
        userMessages[userId] = [];
    }

    let messageData = {};
    if (ctx.message.text) {
        messageData = {
            type: 'text',
            content: ctx.message.text
        };
    } else if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        messageData = {
            type: 'photo',
            content: {
                file_id: photo.file_id,
                caption: ctx.message.caption || ''
            }
        };
    } else if (ctx.message.video) {
        messageData = {
            type: 'video',
            content: {
                file_id: ctx.message.video.file_id,
                caption: ctx.message.caption || ''
            }
        };
    } else if (ctx.message.audio) {
        messageData = {
            type: 'audio',
            content: {
                file_id: ctx.message.audio.file_id,
                caption: ctx.message.caption || ''
            }
        };
    } else if (ctx.message.document) {
        messageData = {
            type: 'document',
            content: {
                file_id: ctx.message.document.file_id,
                caption: ctx.message.caption || ''
            }
        };
    } else {
        return null;
    }

    const newId = userMessages[userId].length + 1;
    const savedMessage = {
        id: newId,
        type: messageData.type,
        content: messageData.content,
        date: new Date()
    };

    userMessages[userId].push(savedMessage);
    return savedMessage;
}

bot.on('message', (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (ctx.message.text && ctx.message.text.startsWith('/start')) return;

    const savedMessage = saveUserMessage(ctx);
    if (!savedMessage) {
        return ctx.reply("Sorry, that type of message is unsupported.");
    }

    ctx.reply(`Message saved!
ID: ${savedMessage.id}`,
{ reply_to_message_id: ctx.message.message_id });
});

bot.on('inline_query', async (ctx) => {
    const userId = ctx.from.id;
    const query = ctx.inlineQuery.query.trim();
    const messages = userMessages[userId] || [];
    const results = [];

    const isIdQuery = /^\d+$/.test(query);
    if (isIdQuery) {
        const id = parseInt(query);
        const match = messages.find(m => m.id === id);
        if (match) {
            const result = createResult(match);
            if (result) results.push(result);
        }
    } else {
        const lastFive = messages.slice(-5).reverse();
        for (const msg of lastFive) {
            const result = createResult(msg);
            if (result) results.push(result);
        }
    }

    try {
        await ctx.answerInlineQuery(results, { cache_time: 0 });
    } catch (err) {
        console.error("Inline query error:", err);
    }
});

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function createResult(savedMessage) {
    const resultId = `${savedMessage.id}_${Date.now()}`;
    const shortTime = formatTime(savedMessage.date);
    const typeLabel = savedMessage.type.toUpperCase();
    let preview = "";

    if (savedMessage.type === 'text') {
        preview = savedMessage.content.slice(0, 40);
    } else if (savedMessage.content.caption) {
        preview = savedMessage.content.caption.slice(0, 40);
    }

    const description = `${typeLabel} | ${preview} | ID: ${savedMessage.id} | ${shortTime}`;

    switch (savedMessage.type) {
        case 'text':
            return {
                type: 'article',
                id: resultId,
                title: `TEXT #${savedMessage.id}`,
                description,
                input_message_content: {
                    message_text: savedMessage.content
                }
            };

        case 'photo':
            return {
                type: 'photo',
                id: resultId,
                photo_file_id: savedMessage.content.file_id,
                title: `PHOTO #${savedMessage.id}`,
                description,
                caption: savedMessage.content.caption || ''
            };

        case 'video':
            return {
                type: 'video',
                id: resultId,
                video_file_id: savedMessage.content.file_id,
                title: `VIDEO #${savedMessage.id}`,
                description,
                caption: savedMessage.content.caption || ''
            };

        case 'audio':
            return {
                type: 'article',
                id: resultId,
                title: `AUDIO #${savedMessage.id}`,
                description,
                input_message_content: {
                    message_text: `[AUDIO] ${savedMessage.content.caption || ''}`
                }
            };

        case 'document':
            return {
                type: 'article',
                id: resultId,
                title: `DOCUMENT #${savedMessage.id}`,
                description,
                input_message_content: {
                    message_text: `[DOCUMENT] ${savedMessage.content.caption || ''}`
                }
            };

        default:
            return null;
    }
};

bot.launch();
console.log("Bot is running...");
