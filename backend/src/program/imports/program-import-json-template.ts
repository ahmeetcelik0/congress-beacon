import { ExtractionResult } from '../extraction/extraction-schema';

// Faz 4d: "JSON Yükle" akışının indirilebilir örneği - kanonik şemayla
// (shared/congress-program.schema.json) BİREBİR aynı yapıdadır, ikinci bir
// şema İCAT EDİLMEZ. İçerik kasıtlı olarak zengin: 2 gün, 3 salon
// (Ana Salon, Salon B, Salon C), oturum başkanı VE panelistli bir oturum,
// birden fazla öğeli bir oturum (sunum + bildiri kodlu sunum + tartışma
// bloğu), tek konuşmacılı bir davetli konuşma, ve `items: []` ile temsil
// edilen bir kahve arası.
export const PROGRAM_IMPORT_JSON_TEMPLATE: ExtractionResult = {
  schemaVersion: '1.0',
  congress: {
    name: 'Örnek Kongre 2026',
    startDate: '2026-09-10',
    endDate: '2026-09-11',
    venue: 'İstanbul Kongre Merkezi',
  },
  days: [
    {
      date: '2026-09-10',
      label: '1. Gün',
      halls: [
        {
          name: 'Ana Salon',
          nameEn: 'Main Hall',
          events: [
            {
              startTime: '09:00',
              endTime: '10:30',
              type: 'session',
              title: 'Açılış Oturumu',
              titleEn: 'Opening Session',
              series: null,
              keywords: ['açılış', 'girişimsel kardiyoloji'],
              chairs: ['Prof. Dr. Şule Çelik'],
              panelists: ['Doç. Dr. Mehmet Yıldız', 'Uzm. Dr. Zeynep Arslan'],
              items: [
                {
                  startTime: '09:00',
                  endTime: '09:20',
                  type: 'presentation',
                  code: null,
                  title: 'Kongre Açılış Konuşması',
                  speakers: ['Prof. Dr. Şule Çelik'],
                },
                {
                  startTime: '09:20',
                  endTime: '09:45',
                  type: 'presentation',
                  code: 'ZS 001',
                  title: 'Zor Bir Perkütan Koroner Girişim Olgusu',
                  speakers: ['Dr. Ali Veli'],
                },
                {
                  startTime: '09:45',
                  endTime: '10:00',
                  type: 'discussion',
                  code: null,
                  title: 'Tartışma',
                  speakers: [],
                },
              ],
            },
            {
              startTime: '10:30',
              endTime: '11:00',
              type: 'break',
              title: 'Kahve Arası',
              titleEn: 'Coffee Break',
              series: null,
              keywords: [],
              chairs: [],
              panelists: [],
              items: [],
            },
          ],
        },
        {
          name: 'Salon B',
          nameEn: null,
          events: [
            {
              startTime: '11:00',
              endTime: '11:30',
              type: 'session',
              title: 'Davetli Konuşma: Yapay Zeka ve Kardiyoloji',
              titleEn: null,
              series: null,
              keywords: ['yapay zeka'],
              chairs: [],
              panelists: [],
              items: [
                {
                  startTime: '11:00',
                  endTime: '11:30',
                  type: 'presentation',
                  code: null,
                  title: 'Yapay Zeka ve Kardiyoloji',
                  speakers: ['Prof. Dr. Ahmet Yılmaz'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      date: '2026-09-11',
      label: '2. Gün',
      halls: [
        {
          name: 'Salon C',
          nameEn: null,
          events: [
            {
              startTime: '09:00',
              endTime: '10:30',
              type: 'session',
              title: 'Olgu Tartışmaları',
              titleEn: null,
              series: null,
              keywords: ['olgu sunumu'],
              chairs: ['Doç. Dr. Mehmet Yıldız'],
              panelists: ['Prof. Dr. Ahmet Yılmaz'],
              items: [
                {
                  startTime: '09:00',
                  endTime: '09:20',
                  type: 'presentation',
                  code: 'ZS 002',
                  title:
                    'Elektif LAD Perkütan Koroner Girişimi Sırasında Gelişen Komplikasyon',
                  speakers: ['Uzm. Dr. Zeynep Arslan'],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
