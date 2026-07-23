import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// Ayni DTO icindeki baska bir sayisal alandan kesinlikle buyuk olma kurali.
// Salon tespitinde giris esiginin cikis esiginden buyuk olmasi zorunludur:
// esit ya da ters verilirse histerezis coker ve katilimci her olcumde
// girip cikiyor gorunur.
export function IsGreaterThanField(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterThanField',
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
          // Kismi PATCH'te diger alan gonderilmemis olabilir; o durumda
          // burada karar verilemez, CongressService.update icindeki
          // birlesik (kayitli deger + gelen deger) kontrol devreye girer.
          if (typeof value !== 'number' || typeof relatedValue !== 'number') {
            return true;
          }
          return value > relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} degeri ${relatedPropertyName} degerinden buyuk olmalidir`;
        },
      },
    });
  };
}
