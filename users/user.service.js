const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('_helpers/db');
const User = db.User;
const request = require('request');
const nodemailer = require('nodemailer');
const xoauth2 = require('xoauth2');
const smtpTransport = require('nodemailer-smtp-transport');

module.exports = {
    authenticate,
    getAll,
    getById,
    createEmail,
    createGoogle,
    createFacebook,
    update,
    delete: _delete
};

async function authenticate({ username, password }) {
    const user = await User.findOne({ username });
    if (user && bcrypt.compareSync(password, user.hash)) {
        const { hash, ...userWithoutHash } = user.toObject();
        const token = jwt.sign({ sub: user.id }, config.secret);
        return {
            ...userWithoutHash,
            token
        };
    }
}

async function getAll() {
    return await User.find().select('-hash');
}

async function getById(id) {
    return await User.findById(id).select('-hash');
}

async function createEmail(userParam) {
    // validate username
    if (await User.findOne({ username: userParam.username })) {
        throw 'Username "' + userParam.username + '" is already taken';
    }

    // validate email
    if (!validateEmail(userParam.email)) {
        throw 'Email "' + userParam.email + '" is incorrect';
    }
    let email = await User.findOne({ email: userParam.email });
    if (email) {
        throw 'Email "' + userParam.email + '" is already taken';
    }

    const user = new User(userParam);

    // hash and validate password
    if (userParam.password) {
        user.hash = bcrypt.hashSync(userParam.password, 10);
    }
    if (!validatePasswd(userParam.password)) {
        throw 'Password must be eight characters or longer';
    }

    // save user
    await user.save();

    // email to user
    sendMail(userParam.email);

    // send coupon
    sendCoupon(userParam);

    // return token
    const token = jwt.sign({ sub: user.hash }, config.secret);
    return { token: token };
}

async function createGoogle(userParam) {
    body = await getOAuthProfile(`https://oauth2.googleapis.com/tokeninfo?id_token=${userParam.token}`);
    const user = new User({
        username: body.name,
        email: body.email,
        hash: body.at_hash,
    });
    // save user
    await user.save();

    // email to user
    sendMail(userParam.email);

    // send coupon
    sendCoupon(userParam);

    // return token
    const token = jwt.sign({ sub: user.hash }, config.secret);
    return { token: token };
};

async function getOAuthProfile(url) {
    return new Promise((resolve, reject) => {
        if (!accessToken) {
            resolve(null);
            return
        };
        request(
            url,
            function (error, response, body) {
                if (error) {
                    reject(error);
                }
                body = JSON.parse(body);
                if (body.error) {
                    reject(body.error);
                } else {
                    resolve(body);
                }
            }
        )
    })
}

async function createFacebook(userParam) {
    body = await getOAuthProfile(`https://graph.facebook.com/debug_token?input_token=${userParam.inputToken}&access_token=${userParam.accessToken}`);
    const user = new User({
        username: body.name,
        email: body.email,
        hash: bcrypt.hashSync(body.email, 10),
    });
    // save user
    await user.save();

    // email to user
    sendMail(userParam.email);

    // send coupon
    sendCoupon(userParam);

    // return token
    const token = jwt.sign({ sub: user.hash }, config.secret);
    return { token: token };
};


async function update(id, userParam) {
    const user = await User.findById(id);

    // validate
    if (!user) throw 'User not found';
    if (user.username !== userParam.username && await User.findOne({ username: userParam.username })) {
        throw 'Username "' + userParam.username + '" is already taken';
    }

    // hash password if it was entered
    if (userParam.password) {
        userParam.hash = bcrypt.hashSync(userParam.password, 10);
    }

    // copy userParam properties to user
    Object.assign(user, userParam);

    await user.save();
}

async function _delete(id) {
    await User.findByIdAndRemove(id);
}

function validateEmail(email) {
    let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function validatePasswd(passwd) {
    let re = /^(?=.{8,})/;
    return re.test(String(passwd));
}

function sendMail(email) {
    let mailTransport = nodemailer.createTransport(smtpTransport({
        service: 'Gmail',
        xoauth2: xoauth2.createXOAuth2Generator({
            user: config.gmailUserID,
            pass: config.gmailPassword,
        })
    }));
    mailTransport.sendMail({
        from: 'sender <' + config.senderMail + '>',
        to: 'receiver <' + email + '>',
        subject: config.senderMailSubject,
        html: config.senderMailHtml,
    }, err => {
        if (err) {
            console.log('Unable to send email: ' + err);
        }
    });
}

function sendCoupon(user) {
    // Await specfic design
}