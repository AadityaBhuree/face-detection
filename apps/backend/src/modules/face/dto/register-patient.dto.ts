import {
  IsString,
  IsBoolean,
  IsArray,
  IsNumber,
  IsOptional,
  IsDefined,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterPatientDto {
  @ApiProperty({ description: 'Patient full name', example: 'Ramesh Kumar' })
  @IsDefined()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Date of birth (ISO 8601)', example: '1985-04-12' })
  @IsDefined()
  @IsString()
  dob!: string;

  @ApiProperty({ description: 'Mobile number (10 digits)', example: '9876543210' })
  @IsDefined()
  @IsString()
  mobile!: string;

  @ApiProperty({
    description: 'Explicit consent for face-vector storage (mandatory)',
    example: true,
  })
  @IsDefined()
  @IsBoolean()
  consent!: boolean;

  @ApiProperty({
    description: '512-dim L2-normalized face embedding',
    example: [0.012, -0.034, 0.98],
  })
  @IsDefined()
  @IsArray()
  @IsNumber({}, { each: true })
  embedding!: number[];
}

export class RegisterPatientResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  message!: string;
}

export class PatientSearchResponseDto {
  @ApiProperty()
  patientId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  patientName!: string;
}

export class SearchByFaceDto {
  @ApiProperty({
    description: '512-dim L2-normalized face embedding',
    example: [0.012, -0.034, 0.98],
  })
  @IsDefined()
  @IsArray()
  @IsNumber({}, { each: true })
  vector!: number[];

  @ApiPropertyOptional({ description: 'Cosine match threshold (0..1)', example: 0.82 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;

  @ApiPropertyOptional({ description: 'Max results to return', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number;
}
