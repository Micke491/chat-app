import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const auth = verifyToken(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const url = searchParams.get('url');

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            next: { revalidate: 3600 } 
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch URL" }, { status: response.status });
        }

        const html = await response.text();

        const getMetaTag = (property: string) => {
            const regex = new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:)?${property}["'][^>]+content=["']([^"']+)["']`, 'i');
            const match = html.match(regex);
            if (match) return match[1];

            const regexReverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?${property}["']`, 'i');
            const matchReverse = html.match(regexReverse);
            return matchReverse ? matchReverse[1] : null;
        };

        const getTitle = () => {
            const ogTitle = getMetaTag('title');
            if (ogTitle) return ogTitle;
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            return titleMatch ? titleMatch[1] : null;
        };

        const getDescription = () => {
            return getMetaTag('description');
        };

        const getImage = () => {
            return getMetaTag('image');
        };

        const metadata = {
            title: getTitle(),
            description: getDescription(),
            image: getImage(),
            url: url
        };

        return NextResponse.json(metadata);
    } catch (error) {
        console.error("Error fetching URL metadata:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
