import { NextResponse } from "next/server";
import { searchEvents } from "@/lib/valyu";

export const dynamic = "force-dynamic";
import { geocodeLocationsFromText } from "@/lib/geocoding";
import { createThreatEvent } from "@/lib/event-classifier";
import type { ThreatEvent } from "@/types";

const THREAT_QUERIES = [
  "breaking news conflict military",
  "geopolitical crisis tensions",
  "protest demonstration unrest",
  "natural disaster emergency",
  "terrorism attack security",
  "cyber attack breach",
  "diplomatic summit sanctions",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  try {
    const searchQueries = query ? [query] : THREAT_QUERIES.slice(0, 3);

    // Run all searches in parallel
    const searchResultsArrays = await Promise.all(
      searchQueries.map((q) => searchEvents(q, { maxResults: 10 }))
    );
    const allResults = searchResultsArrays.flat();

    // Run all geocoding in parallel
    const eventsWithLocations = await Promise.all(
      allResults.map(async (result) => {
        const locations = await geocodeLocationsFromText(
          `${result.title} ${result.content}`,
          result.title
        );

        const location = locations[0] || {
          latitude: 0,
          longitude: 0,
          placeName: "Unknown",
        };

        if (location.latitude === 0 && location.longitude === 0) {
          return null;
        }

        return createThreatEvent(
          result.title,
          result.content,
          location,
          result.source || "web",
          result.url,
          result.publishedDate
        );
      })
    );

    // Filter out nulls and duplicates
    const validEvents = eventsWithLocations.filter(
      (event): event is ThreatEvent => event !== null
    );

    const uniqueEvents = validEvents.filter(
      (event, index, self) =>
        index === self.findIndex((e) => e.title === event.title)
    );

    // Sort by publication date (most recent first)
    const sortedEvents = uniqueEvents.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      events: sortedEvents,
      count: sortedEvents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { queries } = body;

    if (!queries || !Array.isArray(queries)) {
      return NextResponse.json(
        { error: "Invalid queries parameter" },
        { status: 400 }
      );
    }

    // Run all searches in parallel
    const searchResultsArrays = await Promise.all(
      queries.slice(0, 5).map((query) => searchEvents(query, { maxResults: 15 }))
    );
    const allResults = searchResultsArrays.flat();

    // Run all geocoding in parallel
    const eventsWithLocations = await Promise.all(
      allResults.map(async (result) => {
        const locations = await geocodeLocationsFromText(
          `${result.title} ${result.content}`,
          result.title
        );

        const location = locations[0] || {
          latitude: 0,
          longitude: 0,
          placeName: "Unknown",
        };

        if (location.latitude === 0 && location.longitude === 0) {
          return null;
        }

        return createThreatEvent(
          result.title,
          result.content,
          location,
          result.source || "web",
          result.url,
          result.publishedDate
        );
      })
    );

    // Filter out nulls and duplicates
    const validEvents = eventsWithLocations.filter(
      (event): event is ThreatEvent => event !== null
    );

    const uniqueEvents = validEvents.filter(
      (event, index, self) =>
        index === self.findIndex((e) => e.title === event.title)
    );

    // Sort by publication date (most recent first)
    const sortedEvents = uniqueEvents.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      events: sortedEvents,
      count: sortedEvents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
