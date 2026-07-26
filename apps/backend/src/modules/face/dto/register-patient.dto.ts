import { IsString, IsBoolean, IsArray, IsNumber, IsOptional, IsDefined, Min, Max } from 'class-validator';

export class RegisterPatientDto {
  @IsDefined()
  @IsString()
  name!: string;

  @IsDefined()
  @IsString()
  dob!: string;

  @IsDefined()
  @IsString()
  mobile!: string;

  @IsDefined()
  @IsBoolean()
  consent!: boolean;

  @IsDefined()
  @IsArray()
  @IsNumber({}, { each: true })
  embedding!: number[];
}

export class RegisterPatientResponseDto {
  id!: string;
  name!: string;
  message!: string;
}

export class PatientSearchResponseDto {
  patientId!: string;
  score!: number;
  patientName!: string;
}

export class SearchByFaceDto {
  @IsDefined()
  @IsArray()
  @IsNumber({}, { each: true })
  vector!: number[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number;
}
