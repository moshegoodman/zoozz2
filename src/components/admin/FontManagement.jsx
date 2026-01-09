import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/entities/AppSettings';
import { UploadFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, CheckCircle, Loader2, Type } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const FontUploader = ({ title, description, fontUrl, onUploadSuccess, t }) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.ttf')) {
            alert(t('errorInvalidFileType'));
            return;
        }

        setIsUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            onUploadSuccess(file_url);
            alert(t('successFontUploaded'));
        } catch (error) {
            console.error("Error uploading font file:", error);
            alert(t('errorFontUploadFailed'));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-2"><Type className="w-5 h-5" />{title}</h3>
            <p className="text-sm text-gray-500 mb-4">{description}</p>
            <div className="space-y-2">
                <Label htmlFor={`font-url-${title}`}>{t('currentFontUrl')}</Label>
                <Input
                    id={`font-url-${title}`}
                    readOnly
                    value={fontUrl}
                    placeholder={t('noFontUploaded')}
                />
            </div>
            <div className="flex items-center gap-4 mt-4">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".ttf"
                />
                <Button onClick={handleFileSelect} disabled={isUploading}>
                    {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <UploadCloud className="w-4 h-4 mr-2" />
                    )}
                    {t('uploadButton')}
                </Button>
                {fontUrl && <CheckCircle className="w-6 h-6 text-green-500" />}
            </div>
        </div>
    );
};


export default function FontManagement() {
    const { language } = useLanguage();
    const [settings, setSettings] = useState(null);
    const [fontUrlRegular, setFontUrlRegular] = useState('');
    const [fontUrlBold, setFontUrlBold] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const translations = {
        English: {
            title: "PDF Font Management",
            description: "Upload custom TrueType Font (.ttf) files for Hebrew PDF generation. Providing both Regular and Bold weights is recommended for professional-looking documents.",
            currentFontUrl: "Current Font URL",
            noFontUploaded: "No font uploaded yet.",
            uploadButton: "Upload .ttf Font",
            instructions: "After uploading, the new fonts will be used automatically in all generated PDFs.",
            errorInvalidFileType: "Invalid file type. Please upload a .ttf font file.",
            errorFontUploadFailed: "Font upload failed. Please try again.",
            successFontUploaded: "Font uploaded and saved successfully!",
            loading: "Loading...",
            regularTitle: "Regular Font",
            regularDescription: "Used for body text and general content. Recommended: NotoSansHebrew-Regular.ttf",
            boldTitle: "Bold Font",
            boldDescription: "Used for headings and emphasized text. Recommended: NotoSansHebrew-Bold.ttf",
        },
        Hebrew: {
            title: "ניהול גופנים לקובצי PDF",
            description: "העלה קבצי גופן מותאמים אישית (TrueType Font - .ttf) ליצירת קובצי PDF בעברית. מומלץ להעלות גם משקל רגיל וגם משקל מודגש למראה מקצועי.",
            currentFontUrl: "כתובת הגופן הנוכחית",
            noFontUploaded: "עדיין לא הועלה גופן.",
            uploadButton: "העלה קובץ גופן .ttf",
            instructions: "לאחר ההעלאה, הגופנים החדשים ישמשו באופן אוטומטי בכל קובצי ה-PDF שייווצרו.",
            errorInvalidFileType: "סוג קובץ לא חוקי. אנא העלה קובץ גופן .ttf.",
            errorFontUploadFailed: "העלאת הגופן נכשלה. אנא נסה שנית.",
            successFontUploaded: "הגופן הועלה ונשמר בהצלחה!",
            loading: "טוען...",
            regularTitle: "גופן רגיל",
            regularDescription: "משמש לטקסט רץ ותוכן כללי. מומלץ: NotoSansHebrew-Regular.ttf",
            boldTitle: "גופן מודגש",
            boldDescription: "משמש לכותרות והדגשות. מומלץ: NotoSansHebrew-Bold.ttf",
        }
    };

    const t = (key) => translations[language]?.[key] || key;

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const settingsList = await AppSettings.list();
            if (settingsList.length > 0) {
                setSettings(settingsList[0]);
                setFontUrlRegular(settingsList[0].hebrewFontUrlRegular || '');
                setFontUrlBold(settingsList[0].hebrewFontUrlBold || '');
            } else {
                const newSettings = await AppSettings.create({});
                setSettings(newSettings);
                setFontUrlRegular('');
                setFontUrlBold('');
            }
        } catch (error) {
            console.error("Error loading app settings:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleUpload = async (fontType, url) => {
        const newFontData = fontType === 'regular' 
            ? { hebrewFontUrlRegular: url } 
            : { hebrewFontUrlBold: url };

        if (fontType === 'regular') setFontUrlRegular(url);
        if (fontType === 'bold') setFontUrlBold(url);

        try {
            if (settings) {
                const updatedSettings = await AppSettings.update(settings.id, newFontData);
                setSettings(updatedSettings);
            } else {
                // This case should be handled by useEffect, but as a fallback:
                const newSettings = await AppSettings.create(newFontData);
                setSettings(newSettings);
            }
        } catch (error) {
            console.error(`Error saving ${fontType} font URL:`, error);
        }
    };

    if (isLoading) {
        return <div className="text-center py-8">{t('loading')}</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FontUploader
                        title={t('regularTitle')}
                        description={t('regularDescription')}
                        fontUrl={fontUrlRegular}
                        onUploadSuccess={(url) => handleUpload('regular', url)}
                        t={t}
                    />
                    <FontUploader
                        title={t('boldTitle')}
                        description={t('boldDescription')}
                        fontUrl={fontUrlBold}
                        onUploadSuccess={(url) => handleUpload('bold', url)}
                        t={t}
                    />
                </div>
                <p className="text-sm text-gray-500 pt-4 border-t">{t('instructions')}</p>
            </CardContent>
        </Card>
    );
}