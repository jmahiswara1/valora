import { Injectable, type MessageEvent } from '@nestjs/common';
import { Subject, Observable, filter, map } from 'rxjs';

type ChatEvent = { userId: string; conversationId: string; sequence: number };

@Injectable()
export class ConversationEvents {
  private readonly events = new Subject<ChatEvent>();
  publish(event: ChatEvent) { this.events.next(event); }
  forUser(userId: string): Observable<MessageEvent> {
    return this.events.pipe(filter((event) => event.userId === userId), map((event) => ({ type: 'conversation', data: { conversationId: event.conversationId, sequence: event.sequence } })));
  }
}
