import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// Ayni DTO icindeki baska bir tarih alanindan ONCE OLAMAMA kurali (esitlik
// SERBEST - `IsGreaterThanField`in aksine). Kongrenin bitis tarihi baslangic
// tarihinden once olamaz, ama tek gunluk kongrelerde ikisi ayni gun olabilir.
//
// Tarih karsilastirmasi bilincli olarak `new Date(value).getTime()` ile
// yapilir, cıplak lexicographic string karsilastirmasina GUVENILMEZ: alan
// `@IsDateString()` (= IsISO8601 alias, bkz. create-congress.dto.ts) ile
// dogrulaniyor ve bu hem yalin `YYYY-MM-DD` hem de tam
// `YYYY-MM-DDTHH:mm:ss.sssZ` bicimini kabul ediyor. Panel her zaman
// `YYYY-MM-DD` gonderiyor (string sıralaması bu bicimde kronolojik sıralamayla
// birebir orttugu icin `actions.ts`teki basit string karsilastirmasi orada
// GUVENLI) ama bu DTO dogrudan da cagrilabiliyor (ornegin API istemcisi
// tam ISO datetime gonderirse); iki farkli bicim karisirsa string
// karsilastirmasi guvenilmez olur. `Date` constructor'i ISO string'i (her iki
// bicimde de) UTC olarak parse eder, bu yuzden `getTime()` karsilastirmasi
// bicimden bagimsiz ve tutarlidir.
export function IsDateOnOrAfterField(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDateOnOrAfterField',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];
          // Kismi PATCH'te diger alan gonderilmemis olabilir; bu durumda
          // burada karar verilemez - CongressService.update() icindeki
          // (kayitli deger + gelen deger) birlesik kontrolu devreye girer.
          if (typeof value !== 'string' || typeof relatedValue !== 'string') {
            return true;
          }
          const currentTime = new Date(value).getTime();
          const relatedTime = new Date(relatedValue).getTime();
          if (Number.isNaN(currentTime) || Number.isNaN(relatedTime)) {
            // Format hatasi zaten @IsDateString() tarafindan ayrica raporlanir.
            return true;
          }
          return currentTime >= relatedTime;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} degeri ${relatedPropertyName} degerinden once olamaz`;
        },
      },
    });
  };
}
