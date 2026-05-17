// Future portfolio intelligence: typed records for portfolio sources users
// have added to their profile, plus extracted project context.
//
// Not yet wired to a DB table — see lib/portfolio/extract.ts for the
// architectural plan and the reasons we're holding off on creating one.

export type PortfolioStatus = "pending" | "analyzed" | "failed";

export interface PortfolioSource {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  extracted_text: string | null;
  status: PortfolioStatus;
  created_at: string;
  updated_at: string;
}

export interface PortfolioProject {
  title: string;
  url: string | null;
  description: string;
  // Future fields under consideration:
  //   tech?: string[]
  //   year?: string
  //   role?: string
  //   image_refs?: string[]
}
