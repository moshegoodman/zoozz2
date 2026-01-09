import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Scale, ShieldCheck, CreditCard, AlertCircle, Globe, Users, XCircle } from "lucide-react";
import { useLanguage } from "../components/i18n/LanguageContext";

export default function TermsOfService() {
  const { language } = useLanguage();
  
  const sections = [
    {
      icon: FileText,
      title: language === 'Hebrew' ? 'הסכם שימוש' : 'Terms of Use',
      content: language === 'Hebrew'
        ? 'בשימוש באתר זה, המאפשר רכישות לצורכי אירועים, אתה מסכים לתנאים וההגבלות הבאים.'
        : 'In using this website, which facilitates event purchasing needs, you are deemed to have read and agreed to the following terms and conditions.'
    },
    {
      icon: Users,
      title: language === 'Hebrew' ? 'הגדרות' : 'Terminology',
      content: language === 'Hebrew'
        ? 'הטרמינולוגיה הבאה חלה על תנאים והתניות אלה, הצהרת הפרטיות, הצהרת כתב ויתור וכל ההסכמים: "לקוח", "מארגן אירוע", "אתה" ו"שלך" מתייחסים אליך, האדם הניגש לאתר זה ומקבל את התנאים וההתניות של החברה למטרת רכישת סחורות או שירותים הקשורים לאירועים. "ספק" או "מוכר" מתייחסים לגורמים צד שלישי המציעים ומוכרים סחורות או שירותים (כגון קייטרינג, ציוד, אולמות וכו\') דרך הפלטפורמה. "החברה", "עצמנו", "אנחנו" ו"אנו" מתייחסים ל-Zoozz GRP LLC, מפעילת פלטפורמת השוק. "צד", "צדדים" או "אנו" מתייחסים ללקוח, לספקים ו/או לחברה, כפי שההקשר מחייב. כל המונחים מתייחסים להצעה, קבלה ותמורה הדרושים להקלה על עסקאות לצרכי רכישת אירועים בין לקוחות לספקים דרך פלטפורמת החברה, בהתאם לחוק האמריקאי הרלוונטי ובכפוף לו.'
        : 'The following terminology applies to these Terms and Conditions, Privacy Statement, Disclaimer Notice, and any or all Agreements: "Client," "Event Organizer," "You," and "Your" refer to you, the person accessing this website and accepting the Company\'s terms and conditions for the purpose of purchasing event-related goods or services. "Vendor," or "Seller" refers to the third-party entities who offer and sell goods or services (such as catering, equipment, venues, etc.) through the platform. "The Company," "Ourselves," "We," and "Us" refers to our Zoozz GRP LLC, the operator of the marketplace platform. "Party," "Parties," or "Us" refers to the Client, the Vendors, and/or the Company, as the context requires. All terms refer to the offer, acceptance, and consideration necessary to facilitate transactions for event purchasing needs between Clients and Vendors via the Company\'s platform, in accordance with and subject to, prevailing United States Law. Any use of the above terminology or other words in the singular, plural, capitalisation and/or he/she or they, are taken as interchangeable and therefore as referring to same.'
    },
    {
      icon: ShieldCheck,
      title: language === 'Hebrew' ? 'הצהרת פרטיות' : 'Privacy Statement',
      content: language === 'Hebrew'
        ? 'אנו מחויבים להגן על פרטיותך. עובדים מורשים בחברה משתמשים במידע שנאסף מלקוחות בודדים רק על בסיס "צורך לדעת". אנו בוחנים כל הזמן את המערכות והנתונים שלנו כדי להבטיח את השירות הטוב ביותר האפשרי ללקוחותינו. אנו נחקור כל פעולה לא מורשית נגד מערכות מחשב ונתונים במטרה לתבוע ו/או לנקוט הליכים אזרחיים להחזרת נזקים כנגד האחראים.'
        : 'We are committed to protecting your privacy. Authorized employees within the Company only use any information collected from individual customers on a need-to-know basis. We constantly review our systems and data to ensure the best possible service to our customers. We will investigate any unauthorized actions against computer systems and data with a view to prosecuting and/or taking civil proceedings to recover damages against those responsible.'
    },
    {
      icon: Users,
      title: language === 'Hebrew' ? 'סודיות ושיתוף נתונים בסביבה רב-ספקית' : 'Confidentiality and Data Sharing in a Multi-Vendor Environment',
      content: language === 'Hebrew'
        ? 'אנו עומדים בחוקי הגנת הנתונים החלים. כל מידע הנוגע ללקוח ורשומות הלקוח שלו יועבר לספק(ים) הרלוונטיים עמם הלקוח מתנהל (למשל, פרטי אירוע, תאריכים, כתובות משלוח), כנדרש כדי למלא הזמנה, לספק שירות או להקל על תקשורת, כגון דרך מערכת הצ\'אט שלנו. רשומות לקוח נחשבות אחרת לסודיות ולא יימסרו לצד שלישי אלא אם החוק מחייב זאת לרשויות המתאימות. לא נמכור או נשכיר את המידע האישי שלך לצד שלישי. עם זאת, על ידי ביצוע הזמנה לשירותי אירוע באתר זה, אתה מסכים מפורשות שהמידע האישי הנחוץ שלך עשוי להיות משותף עם הספק הרלוונטי כדי להשלים את העסקה שלך, וכאשר ישים, לתקשורת דרך מערכת הצ\'אט או ההודעות הישירות של הפלטפורמה. כל מיילים שישלחו על ידי חברה זו יהיו רק בקשר למתן שירותים ומוצרים מוסכמים, או ניהול פלטפורמה.'
        : 'We comply with applicable data protection laws. Any information concerning the Client and their respective Client Records will be passed to the relevant Vendor(s) with whom the Client transacts (e.g., event details, dates, delivery addresses), as necessary to fulfill an order, provide a service, or facilitate communication, such as through our chat system. Client records are otherwise regarded as confidential and will not be divulged to any third party unless legally required to do so to the appropriate authorities. We will not sell or rent your personal information to any third party. However, by placing an order for event services on this website, you expressly agree that your necessary personal information may be shared with the relevant Vendor to complete your transaction and, where applicable, for communication via the platform\'s chat or direct messaging system. Any emails sent by this Company will only be in connection with the provision of agreed services and products, or platform administration.'
    },
    {
      icon: AlertCircle,
      title: language === 'Hebrew' ? 'הגבלות אחריות (ספציפי לשוק לשירותי אירועים)' : 'Exclusions and Limitations (Marketplace-Specific for Event Services)',
      content: language === 'Hebrew'
        ? 'המידע באתר זה מסופק על בסיס "כמות שהוא". במידה המלאה המותרת בחוק, חברה זו, Zoozz GRP LLC, היא ספקית פלטפורמה ואינה הספקית, הספקית או המוכרת הרשומה של מוצרי הספק או שירותי האירוע. חברה זו: • אינה מציגה ואינה מתחייבת בכל הנוגע לאיכות, התאמה לאירוע ספציפי, מילוי, רישוי או משלוח של הסחורות והשירותים המוצעים על ידי ספקים באתר זה. כל הנושאים הנוגעים לאיכות המוצר/שירות, מילוי, בטיחות ועמידה בתקנות מקומיות (כולל היתרים או רישיונות הנדרשים למתן שירות באירוע) הם באחריות הבלעדית של הספק והלקוח המתאימים. • אינה אחראית לנזקים הנובעים או הקשורים לשימוש שלך במוצרים/שירותים שנרכשו מספקים דרך אתר זה, כולל כישלון של ספק לספק שירותי אירוע חוזיים. • חברה זו אינה, עם זאת, מוציאה אחריות למוות או פגיעה גופנית שנגרמו מרשלנותה בהפעלת הפלטפורמה עצמה. ההגבלות וההחרגות לעיל חלות רק במידה המותרת בחוק. אף אחת מהזכויות החוקיות שלך כצרכן אינה מושפעת.'
        : 'The information on this website is provided on an "as is" basis. To the fullest extent permitted by law, this Company, Zoozz GRP LLC, is a platform provider and is not the provider, supplier, or seller of record for Vendor products or event services. This Company: • Excludes all representations and warranties relating to the quality, fitness for a specific event, fulfillment, licensing, or delivery of the goods and services offered by Vendors on this website. All issues regarding product/service quality, fulfillment, safety, and adherence to local regulations (including permits or licenses required for service delivery at an event) are the sole responsibility of the respective Vendor and the Client. • Excludes all liability for damages arising out of or in connection with your use of the products/services purchased from Vendors via this website, including failure of a Vendor to deliver contracted event services. • This Company does not, however, exclude liability for death or personal injury caused by its negligence in operating the platform itself. The above exclusions and limitations apply only to the extent permitted by law. None of your statutory rights as a consumer are affected.'
    },
    {
      icon: XCircle,
      title: language === 'Hebrew' ? 'מדיניות ביטול (ישירות מהספק)' : 'Cancellation Policy (Vendor Direct)',
      content: language === 'Hebrew'
        ? 'כל ההזמנות לטובין או שירותי אירוע מבוצעות ישירות עם ספק בודד דרך פלטפורמת השוק. אם אתה צריך לבטל או להשעות את ההזמנה שלך, עליך ליצור קשר ישירות עם הספק הספציפי באמצעות תכונת הצ\'אט או ההודעות בפלטפורמה. זמני הקיצוץ לביטול והמדיניות הספציפיים של הספק יחולו. אם אתה נכשל לבטל את ההזמנה על פי המדיניות המוצהרת של הספק, הספק ימלא את ההזמנה שלך, ואנו, Zoozz GRP LLC, לא נוכל להחזיר לך כסף. כל בקשת החזר או ביטול חייבת להיות מאושרת ומעובדת על ידי הספק הרלוונטי בהתאם לתנאים שלו. הלקוח מאשר ששירותי אירוע לעתים קרובות יש מדיניות קפדנית ללא החזר כאשר תאריך האירוע מתקרב.'
        : 'All orders for event goods or services are placed directly with an individual Vendor through the marketplace platform. If you need to cancel or suspend your order, you must contact the specific Vendor directly using the on-platform chat or messaging feature. The Vendor\'s specific cancellation cut-off times and policies will apply. If you fail to cancel the order according to the Vendor\'s stated policy, the Vendor will be filling your order, and we, Zoozz GRP LLC, will be unable to refund you. Any refund or cancellation request must be approved and processed by the relevant Vendor in accordance with their terms. The Client acknowledges that event services often have strict, non-refundable policies as the event date approaches.'
    },
    {
      icon: CreditCard,
      title: language === 'Hebrew' ? 'סיום הסכמים ומדיניות החזרים' : 'Termination of Agreements and Refunds Policy',
      content: language === 'Hebrew'
        ? 'הן הלקוח והן אנחנו (החברה) זכאים לסיים כל הסכם שירותים הקשור לשימוש בפלטפורמה מכל סיבה שהיא. כאשר הזמנת ספק לשירותי אירוע נחשבת כמי שהחלה ונמשכת, לא יינתן החזר על ידי החברה. כל כספים ששולמו לנו המהווים תשלום בגין אספקת שירותי פלטפורמה שלא נוצלו (למשל, דמי מינוי שלא מומשו לפלטפורמה עצמה) יוחזרו. כל החזרים עבור מוצרים או שירותים שנרכשו מספק כפופים למדיניות ההחזר האישית של הספק ויש לעבד אותם ישירות על ידי אותו ספק.'
        : 'Both the Client and ourselves (The Company) have the right to terminate any Services Agreement related to platform use for any reason. Where a Vendor order for event services is deemed to have begun and is underway, no refund will be offered by the Company. Any monies that have been paid to us which constitute payment in respect of the provision of unused platform services (e.g., an unfulfilled subscription fee to the platform itself) shall be refunded. Any refunds for products or services purchased from a Vendor are subject to the individual Vendor\'s refund policy and must be processed directly by that Vendor.'
    },
    {
      icon: Globe,
      title: language === 'Hebrew' ? 'זמינות' : 'Availability',
      content: language === 'Hebrew'
        ? 'אלא אם צוין אחרת על ידי הספק, השירותים והמוצרים המוצגים באתר זה זמינים רק ללקוחות וספקים הממוקמים בארה"ב ובישראל. כל הפרסום מיועד אך ורק לשווקים בארה"ב ובישראל. אתה אחראי בלעדי להערכת ההתאמה למטרה מסוימת של כל הורדות, תוכניות וטקסט הזמינים דרך אתר זה.'
        : 'Unless otherwise stated by the Vendor, the services and products featured on this website are only available to clients and vendors located within the USA and Israel. All advertising is intended solely for the USA and Israel markets. You are solely responsible for evaluating the fitness for a particular purpose of any downloads, programs, and text available through this site.'
    },
    {
      icon: Scale,
      title: language === 'Hebrew' ? 'כללי' : 'General',
      content: language === 'Hebrew'
        ? 'חוקי ארצות הברית וישראל חלים על תנאים והגבלות אלה. בגישה לאתר זה ושימוש בשירותים שלנו ורכישת המוצרים שלנו, אתה מסכים לתנאים וההגבלות האלה ולסמכות השיפוט הבלעדית של בתי המשפט המוסמכים בארצות הברית ובישראל בכל המחלוקות הנובעות מגישה כזו.'
        : 'The laws of the United States and Israel govern these terms and conditions. By accessing this website and using our services and buying our products, you consent to these terms and conditions and to the exclusive jurisdiction of the competent courts in the United States and Israel in all disputes arising out of such access.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {language === 'Hebrew' ? 'תנאי שירות' : 'Terms and Conditions'}
          </h1>
          <p className="text-gray-600 mb-2">
            {language === 'Hebrew' ? 'Zoozz GRP LLC' : 'Zoozz GRP LLC'}
          </p>
          <p className="text-gray-500 text-sm">
            {language === 'Hebrew' 
              ? 'עודכן לאחרונה: אוקטובר 2025'
              : 'Last updated: October 2025'
            }
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-5 h-5 text-green-600" />
                  </div>
                  <span>{section.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {section.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-2 text-green-900">
              {language === 'Hebrew' ? 'שאלות?' : 'Questions?'}
            </h3>
            <p className="text-gray-700">
              {language === 'Hebrew'
                ? 'אם יש לך שאלות לגבי תנאי השירות שלנו, אנא צור איתנו קשר בכתובת support@zoozz.com'
                : 'If you have any questions about our Terms of Service, please contact us at support@zoozz.com'
              }
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Zoozz GRP LLC. {language === 'Hebrew' ? 'כל הזכויות שמורות' : 'All rights reserved'}.</p>
        </div>
      </div>
    </div>
  );
}