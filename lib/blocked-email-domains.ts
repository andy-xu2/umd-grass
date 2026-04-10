/**
 * Known disposable / temporary email domains.
 * Check with: isDisposableEmail(email)
 */
const BLOCKED_DOMAINS = new Set([
  // Mailinator family
  'mailinator.com', 'mailinator2.com', 'mailinator.net',
  'mailinater.com', 'suremail.info', 'spamherelots.com',
  'spamhereplease.com', 'tempr.email', 'dispostable.com',

  // Guerrilla Mail family
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.info',
  'guerrillamailblock.com', 'sharklasers.com', 'grr.la',
  'spam4.me', 'yopmail.com', 'yopmail.fr',

  // Temp-mail / throwaway
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'temp-mail.ru',
  'throwaway.email', 'throwam.com', 'trashmail.com', 'trashmail.at',
  'trashmail.io', 'trashmail.me', 'trashmail.net', 'trashmail.xyz',
  'trashmail.org',

  // Maildrop / discard
  'maildrop.cc', 'discard.email', 'discardmail.com', 'discardmail.de',

  // Fake / spam
  'fakeinbox.com', 'fakeinbox.net', 'spam.la', 'spam.su',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
  'spamfree24.org', 'spamfree.eu', 'spamhole.com', 'spamify.com',
  'spamex.com', 'spam.dk', 'spamthis.co.uk',

  // 10minutemail family
  '10minutemail.com', '10minutemail.net', '10minutemail.org',
  '10minutemail.co.za', '10minutemail.de', '10minutemail.ru',
  '10minutemail.be', '10minutemail.cf', '10minutemail.ga',
  '10minutemail.gq', '10minutemail.ml', '10minutemail.us',
  'tenminutemail.com', 'tenminutemail.net', 'tenminutemail.org',

  // YOPmail family
  'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx',
  'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf',

  // Inboxbear / Mailnull etc.
  'mailnull.com', 'inoutmail.de', 'filzmail.com', 'filzmail.de',
  'meltmail.com', 'anonymstermail.com', 'tempinbox.com',
  'mailexpire.com', 'spamthis.co.uk',

  // Miscellaneous well-known disposable providers
  'getairmail.com', 'mailcatch.com', 'mailnesia.com', 'mailnil.com',
  'mailscrap.com', 'mailsiphon.com', 'mailslapping.com', 'mailzilla.com',
  'maileater.com', 'mailin8r.com', 'mailme24.com', 'mailmetrash.com',
  'mailmoat.com', 'mailnew.com', 'mailseal.de', 'mailshell.com',
  'mailsucker.net', 'mailtemp.info', 'mailtemporaire.com',
  'mailtemporaire.fr', 'mailzilla.org', 'mintemail.com',
  'mt2009.com', 'mt2014.com', 'nospamfor.us', 'nowmymail.com',
  'objectmail.com', 'obobbo.com', 'odnorazovoe.ru', 'oneoffemail.com',
  'onewaymail.com', 'onlatedotcom.info', 'opayq.com',
  'papierkorb.me', 'pecinan.com', 'pecinan.net', 'pecinan.org',
  'pepbot.com', 'phentermine-mortgages.com', 'pimpedupmyspace.com',
  'pjjkp.com', 'plexolan.de', 'poczta.onet.pl',
  'politikerclub.de', 'poofy.org', 'pookmail.com',
  'proxymail.eu', 'qq.com', 'r4nd0m.de',
  'rklips.com', 'rmqkr.net', 'royal.net', 'rppkn.com',
  'rtrtr.com', 's0ny.net', 'safe-mail.net', 'safetymail.info',
  'safetypost.de', 'sandelf.de', 'SendSpamHere.com',
  'sharewaredatabase.com', 'shiftmail.com', 'shitmail.de',
  'shitmail.me', 'shitmail.org', 'shitware.nl', 'shmeriously.com',
  'shotmail.ru', 'skeefmail.com', 'slopsbox.com', 'smellfear.com',
  'snkmail.com', 'sofimail.com', 'sofort-mail.de',
  'sogetthis.com', 'soodonims.com', 'spam.care',
  'spamhereplease.com', 'spamoff.de', 'spamslicer.com',
  'spamspot.com', 'spamstack.net', 'spamtrail.com',
  'speed.1s.fr', 'splyxo.com', 'squizzy.de', 'squizzy.eu',
  'squizzy.net', 'stinkefinger.net', 'stuffmail.de',
  'super-auswahl.de', 'supergreatmail.com', 'supermailer.jp',
  'suremail.info', 'svk.jp', 'sweetxxx.de', 'tafmail.com',
  'tagyourself.com', 'teewars.org', 'teleworm.com', 'teleworm.us',
  'tempalias.com', 'tempcloud.in', 'tempe-mail.com', 'tempemailer.com',
  'tempi.email', 'tempmail.de', 'tempmail.eu', 'tempmail.it',
  'tempmail.net', 'tempmail.us', 'tempmailo.com', 'tempomail.fr',
  'temporaryemail.net', 'temporaryemail.us', 'temporaryforwarding.com',
  'temporaryinbox.com', 'temporarymail.org', 'tempsky.com',
  'tempthe.net', 'tempymail.com', 'thanksnospam.info',
  'thc.st', 'thelimestones.com', 'thisisnotmyrealemail.com',
  'throam.com', 'throwam.com', 'throwde.camp',
  'tittbit.in', 'tizi.com', 'tkitc.de', 'tmail.com', 'tmail.io',
  'tmail.ws', 'tmailinator.com', 'toiea.com', 'tookthe.net',
  'tranceversal.com', 'trash2009.com', 'trash2010.com',
  'trash2011.com', 'trashdevil.com', 'trashdevil.de',
  'trashemail.de', 'trashimail.de', 'trashmail.at', 'trashmail.io',
  'trashmail.me', 'trashmail.net', 'trashmail.xyz',
  'trashmailer.com', 'trashspam.com', 'trillianpro.com',
  'tryalert.com', 'turual.com', 'twinmail.de', 'tyldd.com',
  'uggsrock.com', 'umail.net', 'uroid.com', 'us.af',
  'valemail.net', 'venompen.com', 'veryrealemail.com',
  'vidchart.com', 'viditag.com', 'viewcastmedia.com',
  'viewcastmedia.net', 'viewcastmedia.org',
  'viroleni.cu.cc', 'vkcode.ru', 'vmani.com',
  'vomoto.com', 'vpn.st', 'vsimcard.com',
  'vubby.com', 'wakingupesther.com', 'walala.org',
  'walkmail.net', 'walkmail.ru', 'wetrainbayarea.com',
  'wetrainbayarea.org', 'wh4f.org', 'whatiaas.com',
  'whatifas.com', 'whatsaas.com', 'whopy.com',
  'wilemail.com', 'willhackforfood.biz', 'willselfdestruct.com',
  'wimsg.com', 'wmail.cf', 'world.com', 'writeme.us',
  'wronghead.com', 'wuzupmail.net', 'www.e4ward.com',
  'www.mailinator.com', 'xagloo.co', 'xagloo.com',
  'xemaps.com', 'xents.com', 'xmail.com', 'xmaily.com',
  'xn--9kq967o.com', 'xoxy.net', 'xyzfree.net',
  'yapped.net', 'yeah.net', 'yep.it', 'yogamaven.com',
  'yourdomain.com', 'yuurok.com', 'z1p.biz', 'za.com',
  'zehnminuten.de', 'zehnminutenmail.de', 'zetmail.com',
  'zippymail.info', 'zoemail.net', 'zoemail.org', 'zomg.inf',
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return BLOCKED_DOMAINS.has(domain)
}
