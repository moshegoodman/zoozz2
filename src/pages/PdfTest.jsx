import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, FileDown, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../components/i18n/LanguageContext'; // Import language context

export default function PdfTestPage() {
    const { t, isRTL } = useLanguage(); // Use language context
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [customHtml, setCustomHtml] = useState(
        '<h1>Custom HTML Test</h1>\n' +
        '<p>This is a test of some custom HTML content.</p>\n' +
        '<p style="text-align: right; direction: rtl; font-family: \'Arial\', sans-serif;">בדיקת טקסט בעברית עם יישור לימין.</p>\n' +
        '<ul><li>List item 1</li><li style="direction: rtl;">רשימה 2</li></ul>'
    );

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                if (!['admin', 'chief of staff'].includes(currentUser.user_type)) {
                    setAccessDenied(true);
                }
            } catch (error) {
                setAccessDenied(true);
            } finally {
                setIsLoading(false);
            }
        };
        checkUser();
    }, []);

    const generatePdfFromHtmlElement = async (elementId, filename = 'document.pdf') => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error('Element not found:', elementId);
            alert('Could not find the element to convert.');
            return;
        }

        setIsGenerating(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            let heightLeft = pdfHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();

            while (heightLeft > 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pdf.internal.pageSize.getHeight();
            }

            pdf.save(filename);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Check the console for more details.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Card className="max-w-md mx-auto">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
                        <p className="text-gray-600">You must be an administrator to access this page.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('pdfTest.title', 'Client-Side PDF Generation Test')}</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sample Content Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('pdfTest.sampleContent.title', 'Sample Content Test')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-sm text-gray-600">{t('pdfTest.sampleContent.description', 'This card contains sample content to test the PDF generation. It includes styled text, Hebrew (RTL) text, and an image.')}</p>
                        
                        <div id="sample-content-to-print" className="p-4 border rounded-md min-h-[200px] bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
                            <h2 className="text-xl font-bold mb-2">{t('pdfTest.sampleContent.header', 'Sample Invoice')}</h2>
                            <p className="text-right" dir="rtl">חשבונית לדוגמה</p>
                            <p>{t('pdfTest.sampleContent.paragraph', 'This is a sample paragraph with some text.')}</p>
                            <p className="text-right" dir="rtl">זוהי פסקה לדוגמה עם טקסט בעברית כדי לבדוק את היישור והכיווניות.</p>
                            <img src="https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?w=200&h=100&fit=crop" alt="Sample" className="my-2" />
                            <p className="text-xs text-gray-500">{t('pdfTest.sampleContent.footer', 'End of sample content.')}</p>
                        </div>

                        <Button onClick={() => generatePdfFromHtmlElement('sample-content-to-print', 'sample-content.pdf')} disabled={isGenerating} className="mt-4 w-full">
                            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                            {t('pdfTest.sampleContent.button', 'Generate PDF from Sample')}
                        </Button>
                    </CardContent>
                </Card>

                {/* Custom HTML Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('pdfTest.customHtml.title', 'Custom HTML Test')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-2 text-sm text-gray-600">{t('pdfTest.customHtml.description', 'Paste your own HTML below to see how it renders in the PDF.')}</p>
                        <Textarea 
                            value={customHtml}
                            onChange={(e) => setCustomHtml(e.target.value)}
                            rows={8}
                            className="font-mono text-xs"
                        />
                        
                        <h4 className="font-semibold mt-4 mb-2">{t('pdfTest.customHtml.preview', 'Live Preview:')}</h4>
                        <div id="custom-html-preview-wrapper" className="p-4 border rounded-md min-h-[200px] bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
                            <div dangerouslySetInnerHTML={{ __html: customHtml }} />
                        </div>

                        <Button onClick={() => generatePdfFromHtmlElement('custom-html-preview-wrapper', 'custom-html.pdf')} disabled={isGenerating} className="mt-4 w-full">
                            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                            {t('pdfTest.customHtml.button', 'Generate PDF from Custom HTML')}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}