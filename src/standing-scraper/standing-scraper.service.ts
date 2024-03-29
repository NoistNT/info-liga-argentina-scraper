import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Standing } from 'src/schemas/standing.schema';
import { chromium } from 'playwright';

@Injectable()
export class StandingScraperService {
  constructor(
    @InjectModel('Standing') private standingModel: Model<Standing>,
  ) {}

  async scrapeStandings(): Promise<{
    status: number;
    message: string;
    standings: Standing[] | null;
  }> {
    try {
      const browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://www.promiedos.com.ar/primera');

      const standingsList = await page.$$eval(
        '.tablesorter5 > tbody > tr',
        (rows) => {
          return rows.map((row) => {
            const name = row.children[1].textContent;
            const teamIdRaw = row.querySelector('img')?.getAttribute('src');
            const teamId = teamIdRaw?.split('/').pop()?.split('.').shift();

            return {
              teamId: teamId ? Number(teamId) : 0,
              name: name ? name.trim() : '',
              position: Number(row.children[0].textContent),
              points: Number(row.children[2].textContent),
              played: Number(row.children[3].textContent),
              wins: Number(row.children[4].textContent),
              draws: Number(row.children[5].textContent),
              losses: Number(row.children[6].textContent),
              goalsFor: Number(row.children[7].textContent),
              goalsAgainst: Number(row.children[8].textContent),
              goalsDifference: Number(row.children[9].textContent),
            };
          });
        },
      );

      await page.close();
      await browser.close();

      if (!standingsList) {
        return {
          status: 404,
          message: 'Table not found on the website',
          standings: null,
        };
      }

      for (const standingData of standingsList) {
        const existingStanding = await this.standingModel.findOne({
          name: standingData.name,
        });

        if (existingStanding) {
          await this.standingModel.findByIdAndUpdate(existingStanding);
        }
      }

      return {
        status: 201,
        message: 'Standings scraped successfully',
        standings: standingsList,
      };
    } catch (error) {
      console.error(error);
      return {
        status: 500,
        message: 'Internal server error',
        standings: null,
      };
    }
  }
}
