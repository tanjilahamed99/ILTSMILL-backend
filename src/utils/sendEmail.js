const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAILER_USERNAME,
            pass: process.env.MAILER_PASSWORD,
            type: "Custom",
        },
    });

    await transporter.sendMail({
        from: `"Reset Password" <${process.env.MAILER_FROM}>`,
        to,
        subject,
        text,
    });
    
};

module.exports = sendEmail;
