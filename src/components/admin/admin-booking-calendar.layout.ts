export type CalendarTimedEvent = {
  id: string;
  startMinute: number;
  endMinute: number;
};

export type CalendarPositionedEvent<T extends CalendarTimedEvent> = T & {
  column: number;
  columns: number;
};

export const layoutOverlappingCalendarEvents = <T extends CalendarTimedEvent>(
  sourceEvents: T[],
): CalendarPositionedEvent<T>[] => {
  const events = [...sourceEvents].sort(
    (first, second) =>
      first.startMinute - second.startMinute ||
      first.endMinute - second.endMinute ||
      first.id.localeCompare(second.id),
  );
  const laidOut: CalendarPositionedEvent<T>[] = [];
  let group: T[] = [];
  let groupEnd = -1;

  const flushGroup = () => {
    if (!group.length) return;

    const columnEnds: number[] = [];
    const assigned = group.map((event) => {
      let column = columnEnds.findIndex(
        (endMinute) => endMinute <= event.startMinute,
      );

      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(event.endMinute);
      } else {
        columnEnds[column] = event.endMinute;
      }

      return { ...event, column };
    });
    const columns = Math.max(1, columnEnds.length);

    laidOut.push(...assigned.map((event) => ({ ...event, columns })));
    group = [];
    groupEnd = -1;
  };

  for (const event of events) {
    if (group.length && event.startMinute >= groupEnd) {
      flushGroup();
    }

    group.push(event);
    groupEnd = Math.max(groupEnd, event.endMinute);
  }

  flushGroup();
  return laidOut;
};
