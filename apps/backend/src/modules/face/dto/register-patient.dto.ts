import { IsString, IsBoolean, IsArray, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class RegisterPatientDto {
  @IsString()
  name!: string;

  @IsString()
  dob!: string;

  @IsString()
  mobile!: string;

  @IsBoolean()
  consent!: boolean;

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
