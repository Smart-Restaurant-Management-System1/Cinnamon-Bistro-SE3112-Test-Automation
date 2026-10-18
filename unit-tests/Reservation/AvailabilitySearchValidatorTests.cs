using CinnamonBistro.UnitTests.Support;
using Microsoft.Extensions.Options;
using ReservationService.DTOs;
using ReservationService.Models;
using ReservationService.Services;

namespace CinnamonBistro.UnitTests.Reservation;

/// <summary>
/// Unit tests for <see cref="AvailabilitySearchValidator.TryValidate"/>: guest count, duration, opening hours
/// and "not in the past" rules. Time is injected through <see cref="FixedTimeProvider"/> so every test is deterministic.
/// Rules under test: open 10:00-22:00, duration 30-240 minutes, guests >= 1.
/// </summary>
public class AvailabilitySearchValidatorTests
{
    // "Now" = 2026-10-18 12:00 restaurant-local (UTC is used as the restaurant zone in most tests to avoid tz-database dependence).
    private static readonly DateTimeOffset NowUtc = new(2026, 10, 18, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 18);
    private static readonly DateOnly Tomorrow = new(2026, 10, 19);

    private static AvailabilitySearchValidator CreateSut(
        DateTimeOffset? now = null,
        string timeZoneId = "UTC",
        string opening = "10:00",
        string closing = "22:00") =>
        new(new FixedTimeProvider(now ?? NowUtc),
            Options.Create(new AvailabilityRulesOptions
            {
                TimeZoneId = timeZoneId,
                OpeningTime = opening,
                ClosingTime = closing,
                MinimumDurationMinutes = 30,
                MaximumDurationMinutes = 240
            }));

    private static AvailabilitySearchRequestDto Request(
        DateOnly? date = null, string? start = "18:00", int? duration = 90, int? guests = 4) =>
        new()
        {
            Date = date ?? Tomorrow,
            StartTime = start is null ? null : TimeOnly.ParseExact(start, "HH:mm"),
            DurationMinutes = duration,
            GuestCount = guests
        };

    private static (bool Ok, AvailabilitySearchCriteria? Criteria, Dictionary<string, string[]> Errors) Validate(
        AvailabilitySearchValidator sut, AvailabilitySearchRequestDto? request)
    {
        var ok = sut.TryValidate(request, out var criteria, out var errors);
        return (ok, criteria, errors);
    }

    // ---------- Positive ----------

    [Fact]
    public void TryValidate_ValidRequest_ReturnsCriteriaWithComputedEndTime()
    {
        var (ok, criteria, errors) = Validate(CreateSut(), Request());

        Assert.True(ok);
        Assert.Empty(errors);
        Assert.NotNull(criteria);
        Assert.Equal(new DateTime(2026, 10, 19, 18, 0, 0), criteria!.RequestedStart);
        Assert.Equal(new DateTime(2026, 10, 19, 19, 30, 0), criteria.RequestedEnd);
        Assert.Equal(4, criteria.GuestCount);
    }

    [Theory]
    [InlineData("10:00", 30)]   // opens exactly at opening time, shortest allowed duration
    [InlineData("12:00", 240)]  // longest allowed duration
    [InlineData("20:00", 120)]  // ends exactly at closing time
    public void TryValidate_BoundaryValuesInsideRules_AreAccepted(string start, int duration)
    {
        var (ok, criteria, errors) = Validate(CreateSut(), Request(start: start, duration: duration));

        Assert.True(ok, string.Join("; ", errors.Values.SelectMany(v => v)));
        Assert.Equal(TimeSpan.FromMinutes(duration), criteria!.RequestedEnd - criteria.RequestedStart);
    }

    [Fact]
    public void TryValidate_SingleGuest_IsTheMinimumAcceptedPartySize()
    {
        var (ok, criteria, _) = Validate(CreateSut(), Request(guests: 1));

        Assert.True(ok);
        Assert.Equal(1, criteria!.GuestCount);
    }

    [Fact]
    public void TryValidate_StartExactlyNow_IsNotTreatedAsPast()
    {
        var (ok, _, errors) = Validate(CreateSut(), Request(date: Today, start: "12:00"));

        Assert.True(ok, string.Join("; ", errors.Values.SelectMany(v => v)));
    }

    // ---------- Negative: guest count ----------

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MinValue)]
    public void TryValidate_ZeroOrNegativeGuests_IsRejectedWithGuestCountError(int guests)
    {
        var (ok, criteria, errors) = Validate(CreateSut(), Request(guests: guests));

        Assert.False(ok);
        Assert.Null(criteria);
        Assert.Contains("at least 1", Assert.Single(errors["guestCount"]));
    }

    // ---------- Negative: duration / invalid interval ----------

    [Theory]
    [InlineData(0)]
    [InlineData(-30)]
    public void TryValidate_NonPositiveDuration_IsRejectedAsInvalidInterval(int duration)
    {
        var (ok, criteria, errors) = Validate(CreateSut(), Request(duration: duration));

        Assert.False(ok);
        Assert.Null(criteria);
        Assert.Contains("greater than zero", Assert.Single(errors["durationMinutes"]));
    }

    [Theory]
    [InlineData(29)]
    [InlineData(241)]
    [InlineData(1000)]
    public void TryValidate_DurationOutsideConfiguredRange_IsRejected(int duration)
    {
        var (ok, _, errors) = Validate(CreateSut(), Request(start: "12:00", duration: duration));

        Assert.False(ok);
        Assert.Contains("between 30 and 240", Assert.Single(errors["durationMinutes"]));
    }

    [Fact]
    public void TryValidate_DurationThatOverflowsTheCalendar_IsRejectedInsteadOfThrowing()
    {
        var request = new AvailabilitySearchRequestDto
        {
            Date = DateOnly.MaxValue,
            StartTime = new TimeOnly(23, 59),
            DurationMinutes = 240,
            GuestCount = 2
        };

        var (ok, criteria, errors) = Validate(CreateSut(), request);

        Assert.False(ok);
        Assert.Null(criteria);
        Assert.Contains("invalid booking period", Assert.Single(errors["durationMinutes"]));
    }

    // ---------- Negative: opening hours ----------

    [Theory]
    [InlineData("09:59", 60)]   // starts one minute before opening
    [InlineData("20:01", 120)]  // ends one minute after closing
    [InlineData("21:30", 60)]   // ends after closing
    [InlineData("23:00", 120)]  // would cross midnight
    public void TryValidate_OutsideOpeningHours_IsRejectedWithStartTimeError(string start, int duration)
    {
        var (ok, criteria, errors) = Validate(CreateSut(), Request(start: start, duration: duration));

        Assert.False(ok);
        Assert.Null(criteria);
        Assert.Contains("restaurant hours", Assert.Single(errors["startTime"]));
    }

    // ---------- Negative: past ----------

    [Fact]
    public void TryValidate_DateInThePast_IsRejectedWithDateError()
    {
        var (ok, _, errors) = Validate(CreateSut(), Request(date: Today.AddDays(-1)));

        Assert.False(ok);
        Assert.Contains("past", Assert.Single(errors["date"]));
    }

    [Fact]
    public void TryValidate_TodayButEarlierThanNow_IsRejectedWithStartTimeError()
    {
        var (ok, _, errors) = Validate(CreateSut(), Request(date: Today, start: "11:59"));

        Assert.False(ok);
        Assert.Contains("past", Assert.Single(errors["startTime"]));
    }

    [Fact]
    public void TryValidate_NowIsEvaluatedInRestaurantTimeZone_NotUtc()
    {
        // 05:00 UTC is 10:30 in Asia/Colombo (UTC+05:30). A 10:00 booking today is therefore already in the past.
        var now = new DateTimeOffset(2026, 10, 18, 5, 0, 0, TimeSpan.Zero);
        var sut = CreateSut(now, timeZoneId: "Asia/Colombo");

        var (pastOk, _, pastErrors) = Validate(sut, Request(date: Today, start: "10:00"));
        var (laterOk, _, _) = Validate(sut, Request(date: Today, start: "10:30"));

        Assert.False(pastOk);
        Assert.Contains("past", Assert.Single(pastErrors["startTime"]));
        Assert.True(laterOk);
    }

    // ---------- Negative: missing input ----------

    [Fact]
    public void TryValidate_NullRequest_ReportsEveryRequiredField()
    {
        var (ok, criteria, errors) = Validate(CreateSut(), null);

        Assert.False(ok);
        Assert.Null(criteria);
        Assert.Equivalent(new[] { "date", "startTime", "durationMinutes", "guestCount" }, errors.Keys, strict: false);
    }

    [Fact]
    public void TryValidate_MultipleInvalidFields_ReportsAllOfThemTogether()
    {
        var (ok, _, errors) = Validate(CreateSut(), Request(duration: 0, guests: 0));

        Assert.False(ok);
        Assert.True(errors.ContainsKey("guestCount"));
        Assert.True(errors.ContainsKey("durationMinutes"));
    }

    [Fact]
    public void TryValidate_ErrorKeysAreCaseInsensitive()
    {
        var (_, _, errors) = Validate(CreateSut(), Request(guests: 0));

        Assert.True(errors.ContainsKey("GUESTCOUNT"));
    }

    // ---------- Exceptional paths (misconfiguration) ----------

    [Fact]
    public void Constructor_UnknownTimeZoneId_Throws()
    {
        Assert.Throws<TimeZoneNotFoundException>(() => CreateSut(timeZoneId: "Not/AZone"));
    }

    [Fact]
    public void TryValidate_MalformedOpeningTimeSetting_ThrowsInvalidOperationNamingTheSetting()
    {
        var sut = CreateSut(opening: "9am");

        var ex = Assert.Throws<InvalidOperationException>(() => sut.TryValidate(Request(), out _, out _));

        Assert.Contains("OpeningTime", ex.Message);
    }
}
