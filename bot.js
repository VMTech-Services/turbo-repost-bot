require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

// Create bot instance using the token from .env file
const bot = new Telegraf(process.env.BOT_TOKEN);

// In-memory store: a map from user id to an array of saved messages.
// Each saved message will have: id, type, content (data), and date.
const userMessages = {};

// Start command: provides a guide on how to use the bot.
bot.start((ctx) => {
    // Only show guide in private chat
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

// Helper: Save incoming DM messages
function saveUserMessage(ctx) {
    const userId = ctx.from.id;
    if (!userMessages[userId]) {
        userMessages[userId] = [];
    }

    // Determine message type and content.
    let messageData = {};
    if (ctx.message.text) {
        messageData = {
            type: 'text',
            content: ctx.message.text
        };
    } else if (ctx.message.photo) {
        // Choose the largest photo size.
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
        // Unsupported type.
        return null;
    }

    // Create a new numeric ID.
    const newId = userMessages[userId].length + 1;
    const savedMessage = {
        id: newId,
        type: messageData.type,
        content: messageData.content,
        date: new Date() // Save timestamp
    };

    userMessages[userId].push(savedMessage);
    return savedMessage;
}

// DM handler: only process messages in private chat (ignoring /start as it's already handled)
bot.on('message', (ctx) => {
    if (ctx.chat.type !== 'private') return; // only accept DM messages
    if (ctx.message.text && ctx.message.text.startsWith('/start')) return;

    const savedMessage = saveUserMessage(ctx);
    if (!savedMessage) {
        return ctx.reply("Sorry, that type of message is unsupported.");
    }

    // Reply with saved info.
    ctx.reply(`Message saved!
ID: ${savedMessage.id}`,
{ reply_to_message_id: ctx.message.message_id });
});

// Inline query handler
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
        // Always show last 5 messages, even if query is not numeric.
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

// Helper to format time (HH:MM)
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Function to create an inline result based on a saved message.
function createResult(savedMessage) {
    // Use a unique inline result id with timestamp appended to avoid caching issues.
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

    // Depending on the type, return the appropriate inline result.
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

// No chosen_inline_result handler is needed since there's no repost counter to update.

bot.launch();
console.log("Bot is running...");
