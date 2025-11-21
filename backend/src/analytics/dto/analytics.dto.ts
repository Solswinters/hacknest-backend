import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({ description: 'Total number of users registered' })
  totalUsers: number;

  @ApiProperty({ description: 'Total number of events' })
  totalEvents: number;

  @ApiProperty({ description: 'Total number of submissions' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total number of teams' })
  totalTeams: number;

  @ApiProperty({ description: 'Total number of prizes distributed' })
  totalPrizesDistributed: number;

  @ApiProperty({ description: 'Total value of prizes in USD' })
  totalPrizeValueUSD: number;

  @ApiProperty({ description: 'Number of active users in the last 30 days' })
  activeUsersLast30Days: number;

  @ApiProperty({ description: 'Number of events created in the last 30 days' })
  eventsCreatedLast30Days: number;

  @ApiProperty({ description: 'Growth rate of users (percentage)' })
  userGrowthRate: number;

  @ApiProperty({ description: 'Average submissions per event' })
  avgSubmissionsPerEvent: number;
}

export class UserGrowthDto {
  @ApiProperty({ description: 'Date of the data point' })
  date: Date;

  @ApiProperty({ description: 'Number of new users registered on this date' })
  newUsers: number;

  @ApiProperty({ description: 'Total users as of this date' })
  totalUsers: number;

  @ApiProperty({ description: 'Number of active users on this date' })
  activeUsers: number;
}

export class EventEngagementDto {
  @ApiProperty({ description: 'Event ID' })
  eventId: string;

  @ApiProperty({ description: 'Event name' })
  eventName: string;

  @ApiProperty({ description: 'Number of registrations' })
  registrationsCount: number;

  @ApiProperty({ description: 'Number of submissions' })
  submissionsCount: number;

  @ApiProperty({ description: 'Number of unique participants' })
  participantsCount: number;

  @ApiProperty({ description: 'Number of teams formed' })
  teamsCount: number;

  @ApiProperty({ description: 'Engagement rate (percentage)' })
  engagementRate: number;
}

export class SubmissionTrendDto {
  @ApiProperty({ description: 'Date of the data point' })
  date: Date;

  @ApiProperty({ description: 'Number of submissions on this date' })
  submissionsCount: number;

  @ApiProperty({ description: 'Average quality score (if applicable)' })
  avgQualityScore?: number;

  @ApiProperty({ description: 'Number of submissions completed (vs incomplete drafts)' })
  completedSubmissionsCount: number;
}

export class PayoutMetricDto {
  @ApiProperty({ description: 'Total number of payouts initiated' })
  totalPayoutsInitiated: number;

  @ApiProperty({ description: 'Total number of payouts completed' })
  totalPayoutsCompleted: number;

  @ApiProperty({ description: 'Total number of payouts failed' })
  totalPayoutsFailed: number;

  @ApiProperty({ description: 'Total amount paid out in USD' })
  totalAmountPaidUSD: number;

  @ApiProperty({ description: 'Average time to complete a payout (in hours)' })
  avgPayoutTimeHours: number;

  @ApiProperty({ description: 'Payout success rate (percentage)' })
  payoutSuccessRate: number;
}

export class RevenueMetricDto {
  @ApiProperty({ description: 'Total sponsorship revenue in USD' })
  totalSponsorshipRevenueUSD: number;

  @ApiProperty({ description: 'Total platform fees collected in USD' })
  totalFeesCollectedUSD: number;

  @ApiProperty({ description: 'Total revenue in USD' })
  totalRevenueUSD: number;

  @ApiProperty({ description: 'Revenue growth rate (percentage)' })
  revenueGrowthRate: number;

  @ApiProperty({ description: 'Number of active sponsors' })
  activeSponsorsCount: number;

  @ApiProperty({ description: 'Average sponsorship amount in USD' })
  avgSponsorshipAmountUSD: number;
}

export class GeographicDistributionDto {
  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-2)' })
  countryCode: string;

  @ApiProperty({ description: 'Country name' })
  countryName: string;

  @ApiProperty({ description: 'Count of users or events from this country' })
  count: number;

  @ApiProperty({ description: 'Percentage of total' })
  percentage: number;
}

export class TechStackUsageDto {
  @ApiProperty({ description: 'Technology or framework name' })
  technology: string;

  @ApiProperty({ description: 'Number of submissions using this technology' })
  usageCount: number;

  @ApiProperty({ description: 'Percentage of submissions using this technology' })
  usagePercentage: number;

  @ApiProperty({ description: 'Average score of submissions using this technology' })
  avgScore?: number;
}

