import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateBusinessPlanDto {
    @IsString()
    @IsNotEmpty()
    business_idea: string;

    @IsString()
    @IsNotEmpty()
    industry: string;

    @IsString()
    @IsNotEmpty()
    target_audience: string;

    @IsString()
    @IsNotEmpty()
    skills: string;

    @IsString()
    @IsNotEmpty()
    budget: string;

    @IsString()
    @IsNotEmpty()
    location: string;

    @IsString()
    @IsNotEmpty()
    experience_level: string;

    @IsString()
    @IsNotEmpty()
    goal: string;

    // Present when this plan is being built from a previously generated
    // idea-engine Idea (the Dashboard's "Build Plan" action). Optional so
    // freeform plan generation (no prior idea) keeps working unchanged.
    @IsString()
    @IsOptional()
    source_idea_id?: string;
}