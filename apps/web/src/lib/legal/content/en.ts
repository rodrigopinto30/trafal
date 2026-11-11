import type { LegalContent } from "../types";

export const legalEn: LegalContent = {
  terms: {
    title: "Terms and conditions",
    summary: "The rules for using Trafal: your account, what you publish, what we can do if something goes wrong and what we do not guarantee.",
    sections: [
      {
        id: "quienes-somos",
        title: "Who we are and what Trafal is",
        blocks: [
          "Trafal is a social network for people who make games that are played in the browser: it is for publishing them, showing progress, getting comments and discovering other people's games. The site is operated by {operator} («we»).",
          "You can write to us at {email}.",
        ],
      },
      {
        id: "aceptacion",
        title: "Acceptance and minimum age",
        blocks: [
          "By creating an account or using Trafal you accept these terms, the Privacy policy, the Community guidelines and the Copyright policy. If you do not agree, do not use the site.",
          "You must be {minAge} or older. When you sign up you declare it with a checkbox, and we keep the date you did it and the version of the terms you accepted. If we learn that someone is under the minimum age, we may close their account.",
          "Browsing, playing and reading do not need an account. Publishing, commenting, reacting, reporting and following other people do.",
        ],
      },
      {
        id: "cuenta",
        title: "Your account",
        blocks: [
          "You are responsible for what is done with your account. Pick a password you do not use elsewhere and do not share it. If you think someone got into your account, tell us.",
          "Your @username has to be yours: you cannot impersonate another person, a studio or the Trafal team, and some names are reserved. The details in your profile must be true where it matters: do not pretend to be someone you are not.",
          "One person, one account. Do not sell or hand over your account.",
        ],
      },
      {
        id: "tu-contenido",
        title: "What you publish and the licence you give us",
        blocks: [
          "What you publish (games, updates, images, videos, comments, your profile) is yours. We do not ask you to assign it to us.",
          "So that we can show it, you give us a non-exclusive, free, worldwide licence to:",
          [
            "host, copy and process your content (for example, to check a file or generate thumbnails and sharing cards);",
            "display and run it inside Trafal, and let other people view it, play your game and share it with a link;",
            "keep technical backup copies for the reasonable time it takes to delete them.",
          ],
          "The licence ends when you delete the content or your account, except for those technical copies and for anything other people have already quoted or shared on their own outside Trafal.",
          "You declare that you have the right to publish what you upload: that you made it, or that you have the permission of whoever owns it. If you use other people's art, music, code or trademarks, getting permission is up to you.",
        ],
      },
      {
        id: "juegos",
        title: "Games",
        blocks: [
          "Each game is played inside an isolated frame and on a different domain from Trafal, so that it cannot read your session or your data on the site. Even so, playing a game means running a program made by someone else: you do it at your own risk.",
          "Games go through an automatic check before they are published (file format, size and contents). Passing it does not mean we have reviewed or endorse the game: the check does not catch everything.",
          "A game cannot:",
          [
            "try to leave the frame, read or change the site, or steal data or sessions;",
            "contain malicious software, cryptocurrency mining or hidden tracking of the people who play;",
            "ask for personal data or payments in a misleading way;",
            "be different from what its page says.",
          ],
          "A game may store data in your browser (for example, your progress). That is the game's decision, not Trafal's.",
        ],
      },
      {
        id: "conducta",
        title: "Conduct",
        blocks: [
          "You must follow the Community guidelines. Do not use Trafal for anything illegal, to harass, to deceive or to harm the service or other people.",
          "You also may not automate the use of the site to get around the limits, inflate counters (plays, likes, followers), create accounts in bulk or bypass the captcha.",
        ],
      },
      {
        id: "moderacion",
        title: "Moderation, suspensions and the log",
        blocks: [
          "Anyone with an account can report content. The administration team reviews it, and may hide a game, an update or a comment that breaks these rules, and publish it again if it was a mistake.",
          "When we hide something or suspend an account, we tell the person and give them the reason. A suspended account can sign in and look around, but cannot publish, comment, react, report or follow; a suspension may have an end date.",
          "Every moderation action goes into an internal log that cannot be edited or deleted, recording who acted, on what and why.",
          "If you think we got it wrong, you can appeal the decision from Settings → Moderation: an admin looks at it, answers you and, if they agree with you, reverses it (the suspension is lifted or what was hidden is published again). Each decision can be appealed once. You can also write to us at {email}.",
        ],
      },
      {
        id: "derechos-de-autor",
        title: "Copyright",
        blocks: [
          "We respect copyright and expect the same from the people who publish. If something on Trafal is yours and you did not give permission, you can send us a claim with the form on the Copyright page. Whoever publishes someone else's content without permission may see it hidden and, if it happens again, their account suspended.",
        ],
      },
      {
        id: "limites",
        title: "Usage limits",
        blocks: [
          "To protect the service there are caps on how many times you can do certain actions in a period (for example, commenting, publishing, uploading game versions, reporting or sending claims). If you reach a cap, you have to wait. The caps may change.",
          "Some forms use a captcha to check that whoever is writing is a person.",
        ],
      },
      {
        id: "baja",
        title: "Closing your account and what we can do",
        blocks: [
          "You can delete your account whenever you want from Settings → Account. Your profile, games, updates, comments and files are deleted; it cannot be undone. The moderation log and the copyright claims about your content are kept, without your account.",
          "We may suspend or close an account, or remove content, if you break these terms or the guidelines, if the law requires it or if you put other people or the service at risk. When possible, we tell you beforehand and say why.",
          "We may change or stop offering parts of the service. If it is something important, we will let you know with reasonable notice.",
        ],
      },
      {
        id: "garantias",
        title: "No warranties",
        blocks: [
          "Trafal is offered «as is». We do not guarantee that it will run without interruptions or errors, that other people's games are safe or work on your device, or that the content is accurate. We make backups, but we do not promise that anything will be kept forever: keep a copy of what matters to you.",
        ],
      },
      {
        id: "responsabilidad",
        title: "Limit of liability",
        blocks: [
          "To the maximum extent the law allows, we are not liable for indirect damages, loss of data or opportunities, or for what other people publish or do, including the games you run. Nothing here limits rights that the law does not allow to be limited, for example those of consumers.",
        ],
      },
      {
        id: "cambios",
        title: "Changes to these terms",
        blocks: [
          "We may update these terms. The date above shows the latest version. If a change is important, we will tell you on the site or by email and, when needed, ask you to accept it again. Continuing to use Trafal after a change means you accept it.",
        ],
      },
      {
        id: "ley-aplicable",
        title: "Governing law and contact",
        blocks: [
          "These terms are governed by the laws of {jurisdiction}. If there is a dispute we first try to settle it by talking; if that is not possible, the courts of {jurisdiction} are competent, without prejudice to the rights the law gives you as a consumer.",
          "For any question: {email}.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    summary: "What data we keep, what for, who we share it with and how you can control or delete it.",
    sections: [
      {
        id: "responsable",
        title: "Who is responsible for your data",
        blocks: [
          "The data controller is {operator}. For any question about your data, write to {email}.",
          "We ask for little data on purpose: we do not ask for a date of birth, a phone number or an ID.",
        ],
      },
      {
        id: "que-datos",
        title: "What data we keep",
        blocks: [
          [
            "Account: your email and your password (the authentication service stores it encrypted; we never see it). If you sign in with Google, we receive the basic data of that account that is needed to identify you, such as your email.",
            "Consent: the version of the terms you accepted, when you accepted it and when you confirmed that you are {minAge} or older.",
            "Profile (you fill it in): @username, name, bio, city, country, photo, engines and favourite genres. Your profile is public: it can be seen without signing in.",
            "What you publish: games (with their versions, covers and screenshots), updates with their images or videos, and comments. It is public, except what is a draft.",
            "What you do on the site: likes, saves, who you follow and who follows you, your reports, your notifications and your preferred language.",
            "Plays: when someone plays a game we keep the game and the version, the kind of device (desktop, mobile or tablet), an identifier of the page session and the seconds of active play. If you were signed in, it is tied to your account. We do not keep your IP address in that data.",
            "Abuse control: a record of which actions you did and when, to apply the usage caps, and the result of the captcha on the forms that use it.",
            "Moderation: if action was taken on your account or content, the reason and the record of that action.",
            "Copyright claims: whoever sends one gives us their name, email, organisation (if any), the description of the work and the addresses involved.",
          ],
          "Like any internet service, our providers may record IP addresses and technical browser data in their security and operations logs.",
        ],
      },
      {
        id: "para-que",
        title: "What we use it for",
        blocks: [
          [
            "Giving you the account and the service: signing in, showing your profile, publishing, commenting and telling you what happens with your content.",
            "Showing statistics to the people who make games (for example, how many plays a game had).",
            "Keeping the site safe: enforcing the rules, moderating, stopping abuse and spam, and complying with what the law requires.",
            "We do not advertise, we do not build profiles to sell and we do not sell your data.",
          ],
        ],
      },
      {
        id: "con-quien",
        title: "Who we share it with",
        blocks: [
          "We use providers that process data on our behalf and only to provide the service:",
          [
            "Supabase: database and authentication.",
            "Cloudflare: file storage (R2) and the captcha (Turnstile). Turnstile may use browser data to tell people from programs.",
            "Google, only if you choose to sign in with your Google account.",
            "The provider that hosts the site and the one that sends the confirmation and password-recovery emails.",
          ],
          "What you publish and your profile are public and anyone can see them, including search engines. We may share data if a competent authority requires it, or if it is needed to protect people or the service. In a copyright claim, we may share with the other party what is needed to resolve it.",
          "Some providers may be in other countries, which may have data protection rules different from yours.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies and local storage",
        blocks: [
          "We only use what is needed for the site to work: the cookie of your session when you sign in and a cookie with your language (it lasts a year). We do not use advertising cookies or third-party analytics tools.",
          "Games run on another domain and each one has its own isolated storage. What a game keeps in your browser is that game's decision.",
        ],
      },
      {
        id: "cuanto-tiempo",
        title: "How long we keep it",
        blocks: [
          "We keep your data while you have the account. When you delete it, we delete your profile, your sign-in, your games, updates, comments, reactions, saves, follows, notifications and your files.",
          "We keep, without your account: the moderation log (to account for what was done) and the copyright claims about your content. Our providers' backups may take a while to rotate.",
        ],
      },
      {
        id: "tus-derechos",
        title: "Your rights",
        blocks: [
          "Depending on the law that applies to you, you can access your data, correct it, ask us to delete it, object to some uses and ask for a copy.",
          [
            "Correct: edit your profile in Settings → Profile.",
            "Delete: delete your account in Settings → Account.",
            "Access, ask for a copy or any other right: write to us at {email}. There is no automatic download of your data yet.",
          ],
          "If you think we are not handling your data properly, you can complain to the data protection authority of your country.",
        ],
      },
      {
        id: "menores",
        title: "Minors",
        blocks: ["Trafal is only for people who are {minAge} or older. We do not knowingly collect data from anyone under that age; if we find out, we close the account and delete its data."],
      },
      {
        id: "seguridad",
        title: "Security",
        blocks: [
          "We protect your data with per-account permissions in the database, encryption in transit, encrypted passwords and checks on what is uploaded. No system is infallible: if there were a breach that affects you, we will tell you as appropriate.",
        ],
      },
      {
        id: "cambios",
        title: "Changes to this policy",
        blocks: ["We may update it. The date above shows the latest version; if a change is important, we will tell you."],
      },
    ],
  },
  guidelines: {
    title: "Community guidelines",
    summary: "How we expect to treat each other and what happens when someone does not follow them.",
    sections: [
      {
        id: "espiritu",
        title: "The idea",
        blocks: [
          "Trafal is a place to show what you make, learn from other people and play new things. A community like that works when there is respect, honesty and a will to help. These guidelines explain the basics; they are not a closed list: the administration can act on harmful behaviour even if it is not written here.",
        ],
      },
      {
        id: "respeto",
        title: "Respect",
        blocks: [
          "Treat other people the way you would like to be treated. It is fine to criticise a game; it is not fine to attack whoever made it.",
          "Not allowed:",
          [
            "harassment, threats, insults or stalking, on or off the site;",
            "hate speech or discrimination based on origin, gender, orientation, religion, disability or any other condition;",
            "publishing other people's personal data without their permission;",
            "pretending to be another person, a studio or the Trafal team.",
          ],
        ],
      },
      {
        id: "contenido",
        title: "Content",
        blocks: [
          "Do not publish:",
          [
            "illegal content, or content that shows or promotes real violence or harm to people or animals;",
            "sexually explicit content, and in no case anything involving minors;",
            "extreme graphic violence without a clear game context;",
            "spam, misleading advertising, scams or links that lead to harmful sites;",
            "content that is not yours and that you have no permission for (see Copyright).",
          ],
          "If your game has strong themes, say so clearly in its description.",
        ],
      },
      {
        id: "juegos",
        title: "Honest games",
        blocks: [
          [
            "Make the description, the screenshots and the genre tell the truth about the game.",
            "No malicious software, cryptocurrency mining, hidden tracking or attempts to leave the game frame.",
            "Say whether the game has sound, how it is controlled and whether it works on mobile.",
          ],
        ],
      },
      {
        id: "comentarios",
        title: "Commenting and giving feedback",
        blocks: [
          "A good comment is specific and useful: what you liked, what held you back, what you suggest. Use the tags (Liked it, Suggestion…) when they help.",
          "Answer the questions the creator asks, and mark «This helped» only on what really helped you, if the game is yours.",
        ],
      },
      {
        id: "juego-limpio",
        title: "Fair play",
        blocks: [
          "Do not inflate counters (plays, likes, followers) with fake accounts or programs, do not create accounts in bulk and do not try to get around the usage caps or the captcha.",
        ],
      },
      {
        id: "como-se-aplican",
        title: "How they are enforced",
        blocks: [
          "If you see something that does not follow these guidelines, use the «Report» button. A person on the team reviews it.",
          [
            "We may hide a game, an update or a comment. It is reversible and the person is always told the reason.",
            "We may suspend an account (with or without an end date) or close it in serious or repeated cases.",
            "Everything goes into an internal log that nobody can edit or delete.",
          ],
          "If you think we got it wrong, appeal from Settings → Moderation (once per decision) or write to us at {email}.",
        ],
      },
    ],
  },
  copyright: {
    title: "Copyright",
    summary: "How to claim if something published on Trafal uses your work without permission, and what happens next.",
    sections: [
      {
        id: "principio",
        title: "Our principle",
        blocks: [
          "People who publish on Trafal must have the right to do so. If you think something published infringes your copyright, you can ask us to review it with the claim form on this page.",
        ],
      },
      {
        id: "quien-puede",
        title: "Who can claim",
        blocks: ["The owner of the work, or whoever represents them with authorisation. You do not need a Trafal account."],
      },
      {
        id: "que-incluir",
        title: "What the claim must include",
        blocks: [
          [
            "Your name and a contact email (and the organisation, if you claim on behalf of one).",
            "A description of the work that belongs to you and, if there is one, an address where your original version is published.",
            "The Trafal addresses of the game or update you think infringes it. They must be content that exists on the site.",
            "A statement that you believe in good faith that the use is not authorised by the owner, their representative or the law.",
            "A statement that what you report is accurate and that you are the owner or are authorised to act on their behalf.",
            "Your signature (your full name).",
          ],
        ],
      },
      {
        id: "que-pasa",
        title: "What happens next",
        blocks: [
          [
            "A person on the team takes the claim and reviews it.",
            "If it applies, we hide the claimed content. It is reversible: it is kept safe and can be published again if it was a mistake.",
            "The person who published the content receives a notice with the reason.",
            "Every decision goes into an internal log that cannot be edited or deleted.",
          ],
          "We cannot promise a deadline, but a person looks at every claim. We use your contact details only to handle the claim and may share with the other party what is needed to resolve it.",
        ],
      },
      {
        id: "responder",
        title: "If your content was claimed",
        blocks: [
          "If you think your content was hidden by mistake, for example because you have permission or the work is yours, write to us at {email} with the evidence. There is no counter-notice form today: we resolve it case by case.",
        ],
      },
      {
        id: "reclamos-falsos",
        title: "False claims and repeat infringement",
        blocks: [
          "Sending a false or bad-faith claim may have legal consequences for whoever sends it, and we will reject it. To prevent abuse, the form has a cap on submissions and a captcha.",
          "Whoever repeatedly publishes someone else's content may see their account suspended or closed.",
        ],
      },
    ],
  },
};
