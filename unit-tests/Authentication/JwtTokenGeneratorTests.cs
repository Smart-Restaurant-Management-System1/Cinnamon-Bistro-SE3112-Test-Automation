using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IdentityService.Models;
using IdentityService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CinnamonBistro.UnitTests.Authentication;

/// <summary>
/// Unit tests for <see cref="JwtTokenGenerator"/> using the real class with in-memory configuration
/// (no collaborators to mock). Tokens are decoded and signature-validated rather than string-matched.
/// </summary>
public class JwtTokenGeneratorTests
{
    private const string Key = "unit-test-signing-key-that-is-at-least-32-bytes-long!";
    private const string Issuer = "UnitTestIssuer";
    private const string Audience = "UnitTestAudience";

    private static JwtTokenGenerator CreateSut(string? expiryMinutes = "15") =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = Key,
                ["Jwt:Issuer"] = Issuer,
                ["Jwt:Audience"] = Audience,
                ["Jwt:ExpiryMinutes"] = expiryMinutes
            })
            .Build());

    private static User SampleUser() => new() { UserId = 42, FullName = "Nimal Perera", Email = "nimal@example.com" };

    private static JwtSecurityToken Decode(string token) => new JwtSecurityTokenHandler().ReadJwtToken(token);

    // ---------- Positive ----------

    [Fact]
    public void GenerateToken_ValidUser_ProducesSignedTokenWithIdentityClaims()
    {
        var (token, _) = CreateSut().GenerateToken(SampleUser(), new List<string> { "Customer" });

        var jwt = Decode(token);
        Assert.Equal(Issuer, jwt.Issuer);
        Assert.Contains(Audience, jwt.Audiences);
        Assert.Equal("42", jwt.Subject);
        Assert.Contains(jwt.Claims, c => c.Type == JwtRegisteredClaimNames.Email && c.Value == "nimal@example.com");

        // The signature must verify against the configured key.
        var principal = new JwtSecurityTokenHandler().ValidateToken(token, new TokenValidationParameters
        {
            ValidIssuer = Issuer,
            ValidAudience = Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)),
            ClockSkew = TimeSpan.Zero
        }, out _);
        Assert.Equal("42", principal.FindFirstValue(ClaimTypes.NameIdentifier));
    }

    [Fact]
    public void GenerateToken_MultipleRoles_EmitsOneRoleClaimPerRole()
    {
        var (token, _) = CreateSut().GenerateToken(SampleUser(), new List<string> { "Admin", "KitchenStaff" });

        var roles = Decode(token).Claims.Where(c => c.Type is "role" or ClaimTypes.Role).Select(c => c.Value);
        Assert.Equivalent(new[] { "Admin", "KitchenStaff" }, roles, strict: false);
    }

    [Fact]
    public void GenerateToken_NoRoles_EmitsNoRoleClaims()
    {
        var (token, _) = CreateSut().GenerateToken(SampleUser(), new List<string>());

        Assert.DoesNotContain(Decode(token).Claims, c => c.Type is "role" or ClaimTypes.Role);
    }

    [Fact]
    public void GenerateToken_CalledTwice_ProducesDistinctTokenIds()
    {
        var sut = CreateSut();
        var user = SampleUser();

        var first = Decode(sut.GenerateToken(user, new List<string>()).Token).Id;
        var second = Decode(sut.GenerateToken(user, new List<string>()).Token).Id;

        Assert.False(string.IsNullOrEmpty(first));
        Assert.NotEqual(first, second);
    }

    // ---------- Boundary: expiry ----------

    [Theory]
    [InlineData("15", 15)]
    [InlineData("1", 1)]
    [InlineData("1440", 1440)]
    public void GenerateToken_ConfiguredExpiry_IsAppliedToReturnedExpiresAt(string configured, int expectedMinutes)
    {
        var before = DateTime.UtcNow;
        var (_, expiresAt) = CreateSut(configured).GenerateToken(SampleUser(), new List<string>());
        var after = DateTime.UtcNow;

        Assert.InRange(expiresAt, before.AddMinutes(expectedMinutes), after.AddMinutes(expectedMinutes));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-number")]
    public void GenerateToken_MissingOrInvalidExpiry_FallsBackToSixtyMinutes(string? configured)
    {
        var before = DateTime.UtcNow;
        var (_, expiresAt) = CreateSut(configured).GenerateToken(SampleUser(), new List<string>());
        var after = DateTime.UtcNow;

        Assert.InRange(expiresAt, before.AddMinutes(60), after.AddMinutes(60));
    }

    // ---------- Negative ----------

    [Fact]
    public void GenerateToken_TokenValidatedWithDifferentKey_IsRejected()
    {
        var (token, _) = CreateSut().GenerateToken(SampleUser(), new List<string> { "Customer" });

        Assert.ThrowsAny<SecurityTokenException>(() => new JwtSecurityTokenHandler().ValidateToken(token,
            new TokenValidationParameters
            {
                ValidIssuer = Issuer,
                ValidAudience = Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("a-completely-different-key-of-sufficient-length!!")),
            }, out _));
    }

    [Fact]
    public void GenerateToken_NullRoles_ThrowsNullReferenceException_BecauseRolesAreNotGuarded()
    {
        // Characterisation test: JwtTokenGenerator has no explicit null guard; the failure is the incidental
        // NullReferenceException from iterating the null roles list. Documented as a limitation in the README.
        Assert.Throws<NullReferenceException>(() => CreateSut().GenerateToken(SampleUser(), null!));
    }
}
