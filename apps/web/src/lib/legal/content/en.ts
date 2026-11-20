import type { LegalContent } from "../types";

export const legalEn: LegalContent = {
  terms: {
    title: "Terms and conditions",
    summary: "The rules for using Tradfal, in a few words.",
    sections: [
      {
        id: "que-es",
        title: "What Tradfal is",
        blocks: [
          "Tradfal is a social network where anyone can publish games that run in the browser, show how they make them and play other people's games. By creating an account you accept these rules, the Privacy policy, the Community guidelines and the Copyright policy.",
          "Browsing and playing need no account. Publishing, commenting, liking, saving, following and reporting do.",
        ],
      },
      {
        id: "tu-cuenta",
        title: "Your account",
        blocks: [
          "You must be {minAge} or older; you declare it when you sign up.",
          "One person, one account. You are responsible for what is done with it: use a password you do not use anywhere else and do not share it.",
          "Your @username and your profile cannot pass as another person, a studio or the Tradfal team.",
        ],
      },
      {
        id: "tus-juegos",
        title: "The games you publish",
        blocks: [
          "They must be yours, or you must have permission to use what they bring: images, sounds, music, code and trademarks. Not allowed:",
          [
            "illegal, harassing, hateful or sexually explicit content;",
            "scams, or games that ask for passwords, card details or other personal data;",
            "malware, cryptocurrency mining, hidden tracking or attempts to break out of the game's frame;",
            "games that are not what their page says.",
          ],
          "You still own your game. You give us permission to host it, review it, show it and run it on Tradfal while it is published. The permission ends when you take it down or delete it, except for technical copies, which take a while to be deleted.",
          "Every game goes through an automatic review before it can be published, and it is played in isolation, on another domain. Passing the review does not mean we endorse it: playing a game means running a program someone else made.",
        ],
      },
      {
        id: "lo-demas",
        title: "Updates, comments and profile",
        blocks: [
          "The same goes as for games: what you publish is yours, you give us permission to show it while it is published, and it must follow the Community guidelines.",
        ],
      },
      {
        id: "moderacion",
        title: "Moderation",
        blocks: [
          "We can hide games, updates or comments that break these rules or put the platform at risk, and suspend or close accounts. We always say why.",
          "If you think we got it wrong, you can appeal from Settings → Moderation, once per decision.",
        ],
      },
      {
        id: "limites",
        title: "Limits",
        blocks: [
          "To look after the storage and the service there are caps: how big a game can be, how many images it has, how many times a day you can upload, comment or post. Today's are in the guide «How to upload a game», and they may change.",
          "Getting around them is not allowed: no automating the site, inflating counters or creating accounts in bulk.",
        ],
      },
      {
        id: "baja",
        title: "Closing your account",
        blocks: [
          "You can delete your account whenever you want from Settings → Account. Your profile, games, updates, comments and files are deleted, and it cannot be undone. The moderation log and copyright claims are kept, without your account.",
        ],
      },
      {
        id: "sin-garantias",
        title: "No warranties",
        blocks: [
          "Tradfal is offered as is: there may be outages, bugs, changes or data loss, and we do not guarantee that other people's games work on your device. Keep a copy of whatever matters to you.",
          "As far as the law allows, we are not liable for indirect damages or for what other people publish or do. None of this limits the rights the law gives you as a consumer.",
        ],
      },
      {
        id: "cambios",
        title: "Changes",
        blocks: [
          "We may update these rules; the date above shows the latest version. If the change is important, we tell you on the site and, if needed, ask you to accept it again.",
        ],
      },
      {
        id: "contacto",
        title: "Contact",
        blocks: [
          "To report something, use the «Report» button. For a moderation decision, Settings → Moderation. For copyright, the claims form.",
          "You can also write to us at {email}.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    summary: "What data we keep, what for and how you control it.",
    sections: [
      {
        id: "responsable",
        title: "Who looks after your data",
        blocks: [
          "Your data is handled by the team that runs Tradfal. We ask for little on purpose: no date of birth, phone number or ID.",
          "For any question about your data, write to us at {email}.",
        ],
      },
      {
        id: "que-datos",
        title: "What data we keep",
        blocks: [
          [
            "Your account: your email and your password, which the authentication service stores encrypted (we never see it). If you sign in with Google or Discord, we get the basics to identify you, such as your email and your name.",
            "What you accepted: the version of the terms, when you accepted it and when you confirmed you are {minAge} or older.",
            "Your profile, which is public: @username, name, bio, city, country, photo and favorite genres.",
            "What you publish, which is public except drafts: games with their cover and their versions, updates with their images or videos, and comments.",
            "What you do on the site: likes, saved items, who you follow, your reports, your notifications and your language.",
            "Plays: the game and version, the kind of device, an id of the visit and the seconds played; if you were signed in, your account. We do not keep your IP address.",
            "To stop abuse: when you did certain actions (for the usage caps) and the result of the captcha.",
            "Moderation and claims: the reason and the log of each decision, and the details of whoever sends a copyright claim.",
          ],
          "Our providers may log IP addresses and technical browser data for security.",
        ],
      },
      {
        id: "para-que",
        title: "What we use it for",
        blocks: [
          [
            "Giving you the account and the service, and telling you what happens with your content.",
            "Showing stats to whoever made a game, such as how many plays it had.",
            "Looking after the site: moderating, stopping abuse and complying with the law.",
            "There are no ads, we do not build profiles to sell and we do not sell your data.",
          ],
        ],
      },
      {
        id: "proveedores",
        title: "Who it is shared with",
        blocks: [
          "Only the services that make Tradfal work:",
          [
            "Supabase: database and authentication.",
            "Cloudflare: file storage and captcha (Turnstile, which may look at browser data to tell people from programs).",
            "Google or Discord, only if you sign in with one of them.",
            "The service that hosts the site and the one that sends the emails.",
          ],
          "Your profile and what you publish are public, search engines included. We may share data if a competent authority asks for it, to protect someone or, in a copyright claim, what is needed to resolve it. Some providers are in other countries.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies and storage",
        blocks: [
          "Only what is needed: your session cookie, a cookie with your language (it lasts a year) and, in your browser, whether you muted the games or paused the GIFs. No advertising cookies or third-party analytics.",
          "Games run on another domain and each one has its own storage; what they keep, such as your progress, is up to each game.",
        ],
      },
      {
        id: "cuanto-tiempo",
        title: "How long we keep it",
        blocks: [
          "As long as you have the account. If you delete it, everything of yours is deleted; the moderation log and copyright claims are kept, without your account. The providers' backups take a while to roll over.",
        ],
      },
      {
        id: "tus-derechos",
        title: "Your rights",
        blocks: [
          "You can access your data, correct it, delete it or object to a use:",
          [
            "Correct it: Settings → Profile.",
            "Delete everything: Settings → Account.",
            "Access it or ask for a copy: write to us at {email}.",
          ],
          "If you think we do not handle your data well, you can complain to the data protection authority of your country; in Argentina, the Agencia de Acceso a la Información Pública.",
        ],
      },
      {
        id: "menores",
        title: "Minors",
        blocks: ["Tradfal is for people {minAge} or older. If we find an account of someone younger, we close it and delete their data."],
      },
      {
        id: "seguridad",
        title: "Security",
        blocks: [
          "We protect the data with per-account permissions in the database, encrypted connections, encrypted passwords and a review of everything that is uploaded. No system is perfect: if a breach affects you, we will tell you.",
        ],
      },
      {
        id: "cambios",
        title: "Changes",
        blocks: ["We may update this policy; the date above shows the latest version and, if the change is important, we tell you."],
      },
    ],
  },
  guidelines: {
    title: "Community guidelines",
    summary: "How we treat each other on Tradfal and what happens when someone does not follow the rules.",
    sections: [
      {
        id: "la-idea",
        title: "The idea",
        blocks: [
          "Tradfal is for showing what you make, learning and playing new things, and it works with respect and a will to help. These guidelines are the basics: the team can act on something harmful even if it is not written here.",
        ],
      },
      {
        id: "respeto",
        title: "Respect",
        blocks: [
          "Criticize the game, not the person who made it. Not allowed:",
          [
            "harassment, threats or insults, on and off the site;",
            "hate or discrimination based on origin, gender, orientation, religion, disability or any other condition;",
            "posting other people's personal data;",
            "passing as another person, a studio or the Tradfal team.",
          ],
        ],
      },
      {
        id: "que-no-se-publica",
        title: "Content",
        blocks: [
          "Not allowed:",
          [
            "anything illegal, or real violence or harm to people or animals;",
            "sexually explicit content, and never anything involving minors;",
            "extreme graphic violence outside a clear game context;",
            "spam, scams or links to harmful sites;",
            "other people's work without permission (see Copyright).",
          ],
          "If your game has strong themes, say so in its description.",
        ],
      },
      {
        id: "juegos-honestos",
        title: "Honest games",
        blocks: [
          [
            "The description, the cover and the genre tell the truth.",
            "The game does not ask for passwords, cards or personal data.",
            "No malware, cryptocurrency mining, hidden tracking or attempts to break out of the frame.",
            "Say how it is played and whether it has sound.",
          ],
        ],
      },
      {
        id: "feedback",
        title: "Commenting and giving feedback",
        blocks: [
          "A good comment is specific: what you liked, where you got stuck, what you suggest. Answer the creator's questions and, if the game is yours, mark «This helped» on what truly helped you.",
        ],
      },
      {
        id: "juego-limpio",
        title: "Fair play",
        blocks: ["Do not inflate plays, likes or followers with fake accounts or programs, and do not try to get around the usage caps or the captcha."],
      },
      {
        id: "si-alguien-no-cumple",
        title: "When someone breaks the rules",
        blocks: [
          "Use the «Report» button: a person from the team reviews it.",
          [
            "We can hide a game, an update or a comment, always saying why; it can be undone.",
            "We can suspend an account, with or without an end date, or close it in serious or repeated cases.",
            "Every decision goes into a log that nobody can edit or delete.",
          ],
          "If you think we got it wrong, appeal from Settings → Moderation, once per decision.",
          "You can also write to us at {email}.",
        ],
      },
    ],
  },
  copyright: {
    title: "Copyright",
    summary: "How to make a claim if something published on Tradfal uses your work without permission.",
    sections: [
      {
        id: "la-regla",
        title: "The rule",
        blocks: [
          "You can only publish what is yours or what you have permission to use. If something on Tradfal uses your work without permission, claim it with the form on this page. No account is needed: the rights holder or someone authorized can do it.",
        ],
      },
      {
        id: "que-pide",
        title: "What the claim asks for",
        blocks: [
          [
            "Your name and a contact email, and the organization if you claim on behalf of one.",
            "Which work is yours and, if there is one, where the original is published.",
            "The addresses of the game or the update on Tradfal.",
            "That you declare in good faith that the use is not authorized and that what you report is accurate.",
            "Your signature: your full name.",
          ],
        ],
      },
      {
        id: "que-pasa",
        title: "What happens next",
        blocks: [
          [
            "A person from the team reviews it.",
            "If it applies, we hide the content; it can be published again if it was a mistake.",
            "Whoever published it gets a notice with the reason.",
            "Everything goes into a log that cannot be edited or deleted.",
          ],
          "There is no fixed deadline, but a person looks at every claim. Your data is used only for the claim, and we may give the other party what is needed to resolve it.",
        ],
      },
      {
        id: "si-reclamaron-tu-contenido",
        title: "If your content was claimed",
        blocks: [
          "If you think it was a mistake (you have permission or the work is yours), answer with a counter-notice from Settings → Moderation: you explain why, with your full name and an email, and declare that it is true. A person from the team compares it with the claim and answers you in writing.",
          "So that both sides can talk, we may give your name and email to whoever made the claim; we do not give you theirs.",
          "You can also write to us at {email} with the evidence.",
        ],
      },
      {
        id: "abusos",
        title: "False claims and repeat infringers",
        blocks: [
          "A false or bad-faith claim is rejected and may have legal consequences. The form has a cap on submissions and a captcha. Whoever keeps publishing other people's work may lose their account.",
        ],
      },
    ],
  },
};
