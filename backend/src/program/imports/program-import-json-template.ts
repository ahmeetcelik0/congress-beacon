import { ExtractionResult } from '../extraction/extraction-schema';

// Faz 4c §2: "JSON Yükle" akışının indirilebilir örnegi - LLM'in urettigi
// ExtractionResult ile BIREBIR AYNI semaya uyar (ikinci bir sema burada
// icat EDILMEZ). Icerik kasitli olarak zengin: 2 gun, 3 salon (biri
// otomatik olusturma akisini gostermek icin canli kongrede henuz
// TANIMLI OLMAYAN bir isim - "Salon C"), moderatorlu bir oturum, birden
// fazla sunumlu bir oturum, tek konusmacili bir davetli konusma, ve
// bos `presentations` ile temsil edilen bir kahve arasi (moderator/
// discussant/presentation gerektirmeyen bir "gun" satiri ornegi).
export const PROGRAM_IMPORT_JSON_TEMPLATE: ExtractionResult = {
  days: [
    { label: '1. Gün', date: '2026-09-10' },
    { label: '2. Gün', date: '2026-09-11' },
  ],
  sessions: [
    {
      dayLabel: '1. Gün',
      hallName: 'Ana Salon',
      startTime: '09:00',
      endTime: '10:30',
      title: 'Açılış Oturumu',
      sessionType: 'panel',
      keywords: ['açılış', 'girişimsel kardiyoloji'],
      moderators: ['Prof. Dr. Şule Çelik'],
      discussants: [],
      presentations: [
        {
          title: 'Kongre Açılış Konuşması',
          startTime: '09:00',
          endTime: '09:20',
          speakers: ['Prof. Dr. Şule Çelik'],
        },
        {
          title: 'Güncel Kılavuzlar Işığında Girişimsel Kardiyoloji',
          startTime: '09:20',
          endTime: '10:00',
          speakers: ['Prof. Dr. Ahmet Yılmaz', 'Doç. Dr. Elif Kaya'],
        },
      ],
    },
    {
      dayLabel: '1. Gün',
      hallName: 'Ana Salon',
      startTime: '10:30',
      endTime: '11:00',
      title: 'Kahve Arası',
      sessionType: 'ara',
      keywords: [],
      moderators: [],
      discussants: [],
      presentations: [],
    },
    {
      dayLabel: '1. Gün',
      hallName: 'Salon B',
      startTime: '11:00',
      endTime: '11:30',
      title: 'Davetli Konuşma: Yapay Zeka ve Kardiyoloji',
      sessionType: 'konferans',
      keywords: ['yapay zeka'],
      moderators: [],
      discussants: [],
      presentations: [
        {
          title: 'Yapay Zeka ve Kardiyoloji',
          startTime: '11:00',
          endTime: '11:30',
          speakers: ['Prof. Dr. Mehmet Demir'],
        },
      ],
    },
    {
      dayLabel: '2. Gün',
      hallName: 'Salon C',
      startTime: '09:00',
      endTime: '10:30',
      title: 'Olgu Tartışmaları',
      sessionType: 'panel',
      keywords: ['olgu sunumu'],
      moderators: ['Doç. Dr. Elif Kaya'],
      discussants: ['Prof. Dr. Ahmet Yılmaz', 'Uzm. Dr. Zeynep Arslan'],
      presentations: [
        {
          title: 'Zor Bir Perkütan Koroner Girişim Olgusu',
          startTime: '09:00',
          endTime: '09:20',
          speakers: ['Uzm. Dr. Zeynep Arslan'],
        },
      ],
    },
  ],
};
